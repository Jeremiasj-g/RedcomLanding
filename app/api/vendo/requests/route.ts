import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildVendoEmail } from '@/lib/vendo/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  branchCode: z.string().trim().min(1).max(80),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  movementType: z.enum(['alta', 'baja']),
  imei: z.string().trim().min(6).max(60),
  phone: z.string().trim().min(7).max(40),
  vendorEmail: z.string().trim().email().max(180),
  reason: z.string().trim().min(3).max(1000),
});

function getBearerToken(request: NextRequest) {
  const value = request.headers.get('authorization') ?? '';
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Falta configurar Supabase en el servidor.' },
      { status: 500 },
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'La sesión venció. Volvé a iniciar sesión.' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Revisá los campos del formulario.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: profile, error: profileError }, { data: branch, error: branchError }] =
    await Promise.all([
      admin
        .from('profiles')
        .select('id,email,full_name,role,is_active')
        .eq('id', authData.user.id)
        .single(),
      admin
        .from('branches')
        .select('code,name')
        .ilike('code', parsed.data.branchCode)
        .maybeSingle(),
    ]);

  if (profileError || !profile || !profile.is_active) {
    return NextResponse.json({ error: 'Tu usuario no está habilitado.' }, { status: 403 });
  }
  if (branchError || !branch) {
    return NextResponse.json({ error: 'La sucursal seleccionada ya no existe.' }, { status: 400 });
  }

  const { data: requesterBranches } = await admin
    .from('user_branches')
    .select('branch')
    .eq('user_id', authData.user.id);

  const createdAt = new Date().toISOString();
  const requesterName = String(profile.full_name || profile.email || authData.user.email || 'Usuario');
  const requesterEmail = String(profile.email || authData.user.email || '');

  const { data: inserted, error: insertError } = await admin
    .from('vendo_requests')
    .insert({
      branch_code: String(branch.code).trim().toLowerCase(),
      branch_name: String(branch.name || branch.code),
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      movement_type: parsed.data.movementType,
      imei: parsed.data.imei,
      phone: parsed.data.phone,
      vendor_email: parsed.data.vendorEmail.toLowerCase(),
      reason: parsed.data.reason,
      requested_by: authData.user.id,
      requester_name: requesterName,
      requester_email: requesterEmail,
      requester_role: profile.role,
      requester_branches: (requesterBranches ?? []).map((row: any) => String(row.branch)),
      created_at: createdAt,
      email_status: 'pending',
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    console.error('[vendo] insert', insertError);
    return NextResponse.json({ error: insertError?.message ?? 'No se pudo guardar la solicitud.' }, { status: 500 });
  }

  const { data: recipientRows, error: recipientsError } = await admin
    .from('vendo_notification_recipients')
    .select('user_id')
    .eq('is_active', true);

  if (recipientsError) {
    console.error('[vendo] recipients', recipientsError);
  }

  const recipientIds = Array.from(
    new Set((recipientRows ?? []).map((row: any) => String(row.user_id)).filter(Boolean)),
  );

  let recipientEmails: string[] = [];
  if (recipientIds.length > 0) {
    const { data: recipients } = await admin
      .from('profiles')
      .select('id,email,is_active')
      .in('id', recipientIds)
      .eq('is_active', true);

    recipientEmails = Array.from(
      new Set(
        (recipients ?? [])
          .map((row: any) => String(row.email ?? '').trim().toLowerCase())
          .filter((email: string) => email.includes('@')),
      ),
    );
  }

  if (recipientEmails.length === 0) {
    await admin
      .from('vendo_requests')
      .update({
        email_status: 'no_recipients',
        email_recipients: [],
        email_error: 'No hay destinatarios configurados en Administración > Vendo.',
      })
      .eq('id', inserted.id);

    return NextResponse.json(
      {
        request: { ...inserted, email_status: 'no_recipients', email_recipients: [] },
        warning: 'La solicitud se guardó, pero todavía no hay destinatarios configurados.',
      },
      { status: 201 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    const errorMessage = 'Falta configurar RESEND_API_KEY o RESEND_FROM_EMAIL.';
    await admin
      .from('vendo_requests')
      .update({
        email_status: 'failed',
        email_recipients: recipientEmails,
        email_error: errorMessage,
      })
      .eq('id', inserted.id);

    return NextResponse.json(
      {
        request: { ...inserted, email_status: 'failed', email_recipients: recipientEmails },
        warning: `La solicitud se guardó, pero el correo no pudo enviarse: ${errorMessage}`,
      },
      { status: 201 },
    );
  }

  const email = buildVendoEmail({
    branchName: String(branch.name || branch.code),
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    movementType: parsed.data.movementType,
    imei: parsed.data.imei,
    phone: parsed.data.phone,
    vendorEmail: parsed.data.vendorEmail,
    reason: parsed.data.reason,
    requesterName,
    requesterEmail,
    requesterRole: profile.role,
    createdAt,
  });

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipientEmails,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      cache: 'no-store',
    });
    const resendData = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      throw new Error(resendData?.message ?? resendData?.error ?? 'Resend rechazó el envío.');
    }

    const emailSentAt = new Date().toISOString();
    await admin
      .from('vendo_requests')
      .update({
        email_status: 'sent',
        email_sent_at: emailSentAt,
        email_recipients: recipientEmails,
        resend_email_id: resendData?.id ?? null,
        email_error: null,
      })
      .eq('id', inserted.id);

    return NextResponse.json(
      {
        request: {
          ...inserted,
          email_status: 'sent',
          email_sent_at: emailSentAt,
          email_recipients: recipientEmails,
          resend_email_id: resendData?.id ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido de Resend.';
    console.error('[vendo] resend', error);

    await admin
      .from('vendo_requests')
      .update({
        email_status: 'failed',
        email_recipients: recipientEmails,
        email_error: message,
      })
      .eq('id', inserted.id);

    return NextResponse.json(
      {
        request: { ...inserted, email_status: 'failed', email_recipients: recipientEmails },
        warning: `La solicitud se guardó, pero el correo no pudo enviarse: ${message}`,
      },
      { status: 201 },
    );
  }
}
