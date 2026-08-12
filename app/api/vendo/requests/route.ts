import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildVendoWeb3FormsPayload, getWeb3FormsAccessKey } from '@/lib/vendo/web3forms';
import { VENDO_DELETION_REASON_CODES } from '@/lib/vendo/deletionReasons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  branchCode: z.string().trim().min(1).max(80),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  movementType: z.enum(['alta', 'baja']),
  imei: z.string().trim().max(60).default(''),
  phone: z.string().trim().min(7).max(40),
  vendorEmail: z.string().trim().email().max(180),
  reason: z.string().trim().max(1000).default(''),
});

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('notification'),
    requestId: z.string().uuid(),
    status: z.enum(['sent', 'failed']),
    error: z.string().trim().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal('review'),
    requestId: z.string().uuid(),
    status: z.enum(['accepted', 'rejected']),
    note: z.string().trim().max(1000).nullable().optional(),
  }),
  z.object({
    action: z.literal('request_deletion'),
    requestId: z.string().uuid(),
    reason: z.enum(VENDO_DELETION_REASON_CODES),
    note: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({
    action: z.literal('dismiss_deletion'),
    requestId: z.string().uuid(),
  }),
]);

const deleteSchema = z.object({
  requestId: z.string().uuid().optional(),
  requestIds: z.array(z.string().uuid()).min(1).max(200).optional(),
}).refine((value) => Boolean(value.requestId || value.requestIds?.length), {
  message: 'Debe indicarse al menos una solicitud.',
});

function getBearerToken(request: NextRequest) {
  const value = request.headers.get('authorization') ?? '';
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

type AuthContext = {
  userId: string;
  profile: any;
  admin: SupabaseClient;
};

async function getAuthContext(request: NextRequest): Promise<AuthContext | NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Falta configurar Supabase en el servidor.' }, { status: 500 });
  }

  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'La sesión venció. Volvé a iniciar sesión.' }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,email,full_name,role,is_active')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return NextResponse.json({ error: 'Tu usuario no está habilitado.' }, { status: 403 });
  }

  return { userId: authData.user.id, profile, admin };
}

function isNextResponse(value: AuthContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

function isDeletionMigrationError(error: any) {
  return ['42703', 'PGRST204', '23514'].includes(String(error?.code ?? ''))
    || /deletion_requested_|deletion_reason_|vendo_requests_deletion/i.test(error?.message ?? '');
}

export async function POST(request: NextRequest) {
  const context = await getAuthContext(request);
  if (isNextResponse(context)) return context;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Revisá los campos del formulario.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { admin, profile, userId } = context;
  const { data: branch, error: branchError } = await admin
    .from('branches')
    .select('code,name')
    .ilike('code', parsed.data.branchCode)
    .maybeSingle();

  if (branchError || !branch) {
    return NextResponse.json({ error: 'La sucursal seleccionada ya no existe.' }, { status: 400 });
  }

  const { data: requesterBranches } = await admin
    .from('user_branches')
    .select('branch')
    .eq('user_id', userId);

  const createdAt = new Date().toISOString();
  const requesterName = String(profile.full_name || profile.email || 'Usuario');
  const requesterEmail = String(profile.email || '');
  const requesterBranchNames = (requesterBranches ?? []).map((row: any) => String(row.branch));

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
      requested_by: userId,
      requester_name: requesterName,
      requester_email: requesterEmail,
      requester_role: profile.role,
      requester_branches: requesterBranchNames,
      created_at: createdAt,
      email_status: 'pending',
      email_recipients: [],
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    console.error('[vendo] insert', insertError);
    const optionalFieldsMigrationRequired = ['23514'].includes(String((insertError as any)?.code ?? ''))
      && /vendo_requests_(imei|reason)_check/i.test(insertError?.message ?? '');

    if (optionalFieldsMigrationRequired) {
      return NextResponse.json(
        { error: 'Ejecutá la migración supabase/migrations/20260806_vendo_optional_fields.sql para habilitar los campos opcionales.' },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: insertError?.message ?? 'No se pudo guardar la solicitud.' },
      { status: 500 },
    );
  }

  const accessKey = getWeb3FormsAccessKey();
  if (!accessKey) {
    await admin
      .from('vendo_requests')
      .update({ email_status: 'failed', email_error: 'Falta configurar la Access Key de Web3Forms.' })
      .eq('id', inserted.id);

    return NextResponse.json({
      request: { ...inserted, email_status: 'failed', email_error: 'Falta configurar la Access Key de Web3Forms.' },
      warning: 'La solicitud se guardó, pero falta configurar la Access Key de Web3Forms.',
    }, { status: 201 });
  }

  const notificationPayload = buildVendoWeb3FormsPayload({
    requestId: String(inserted.id),
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
    requesterBranches: requesterBranchNames,
    createdAt,
  }, accessKey);

  return NextResponse.json({ request: inserted, notificationPayload }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const context = await getAuthContext(request);
  if (isNextResponse(context)) return context;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'La actualización solicitada no es válida.' }, { status: 400 });
  }

  const { admin, profile, userId } = context;
  const { data: current, error: currentError } = await admin
    .from('vendo_requests')
    .select('id,requested_by,deletion_requested_at')
    .eq('id', parsed.data.requestId)
    .maybeSingle();

  if (currentError) {
    if (isDeletionMigrationError(currentError)) {
      return NextResponse.json({
        error: 'La base todavía no tiene habilitadas las peticiones de eliminación. Ejecutá supabase/migrations/20260812_vendo_deletion_requests.sql.',
      }, { status: 409 });
    }
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  if (!current) {
    return NextResponse.json({ error: 'La solicitud ya no existe.' }, { status: 404 });
  }

  const isAdmin = profile.role === 'admin';

  if (parsed.data.action === 'notification') {
    if (!isAdmin && current.requested_by !== userId) {
      return NextResponse.json({ error: 'No tenés permiso para actualizar esta solicitud.' }, { status: 403 });
    }

    const sentAt = parsed.data.status === 'sent' ? new Date().toISOString() : null;
    const { data, error } = await admin
      .from('vendo_requests')
      .update({
        email_status: parsed.data.status,
        email_sent_at: sentAt,
        email_error: parsed.data.status === 'failed' ? parsed.data.error || 'Error desconocido de Web3Forms.' : null,
      })
      .eq('id', parsed.data.requestId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data });
  }

  if (parsed.data.action === 'request_deletion') {
    if (current.requested_by !== userId) {
      return NextResponse.json({ error: 'Solo podés pedir la eliminación de tus propias solicitudes.' }, { status: 403 });
    }
    if (current.deletion_requested_at) {
      return NextResponse.json({ error: 'Esta solicitud ya tiene una petición de eliminación pendiente.' }, { status: 409 });
    }

    const requestedAt = new Date().toISOString();
    const { data, error } = await admin
      .from('vendo_requests')
      .update({
        deletion_requested_at: requestedAt,
        deletion_requested_by: userId,
        deletion_reason_code: parsed.data.reason,
        deletion_reason_note: parsed.data.note || null,
      })
      .eq('id', parsed.data.requestId)
      .select('*')
      .single();

    if (error) {
      if (isDeletionMigrationError(error)) {
        return NextResponse.json({
          error: 'La base todavía no tiene habilitadas las peticiones de eliminación. Ejecutá supabase/migrations/20260812_vendo_deletion_requests.sql.',
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ request: data });
  }

  if (!isAdmin) {
    return NextResponse.json({ error: 'Solo administración puede resolver solicitudes.' }, { status: 403 });
  }

  if (parsed.data.action === 'dismiss_deletion') {
    const { data, error } = await admin
      .from('vendo_requests')
      .update({
        deletion_requested_at: null,
        deletion_requested_by: null,
        deletion_reason_code: null,
        deletion_reason_note: null,
      })
      .eq('id', parsed.data.requestId)
      .select('*')
      .single();

    if (error) {
      if (isDeletionMigrationError(error)) {
        return NextResponse.json({
          error: 'La base todavía no tiene habilitadas las peticiones de eliminación. Ejecutá supabase/migrations/20260812_vendo_deletion_requests.sql.',
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ request: data });
  }

  const reviewedAt = new Date().toISOString();
  const reviewerName = String(profile.full_name || profile.email || 'Administración');
  const { data, error } = await admin
    .from('vendo_requests')
    .update({
      status: parsed.data.status,
      reviewed_at: reviewedAt,
      reviewed_by: userId,
      reviewed_by_name: reviewerName,
      review_note: parsed.data.status === 'rejected' ? parsed.data.note || null : null,
      seen_at: reviewedAt,
      seen_by: userId,
    })
    .eq('id', parsed.data.requestId)
    .select('*')
    .single();

  if (error) {
    const migrationRequired = ['23514', '42703', 'PGRST204'].includes(String((error as any).code ?? ''))
      || /reviewed_|vendo_requests_status_check|accepted|rejected/i.test(error.message ?? '');

    if (migrationRequired) {
      return NextResponse.json({
        error: 'La base todavía tiene la estructura anterior de VENDO. Ejecutá la migración supabase/migrations/20260727_vendo_actual_database_fix.sql y volvé a intentar.',
      }, { status: 409 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ request: data });
}

export async function DELETE(request: NextRequest) {
  const context = await getAuthContext(request);
  if (isNextResponse(context)) return context;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Las solicitudes indicadas no son válidas.' }, { status: 400 });
  }

  const ids = Array.from(new Set([
    ...(parsed.data.requestIds ?? []),
    ...(parsed.data.requestId ? [parsed.data.requestId] : []),
  ]));

  const { admin, profile } = context;
  if (profile.role !== 'admin') {
    return NextResponse.json({
      error: 'Las solicitudes solo pueden ser eliminadas por Administración. Usá la opción “Solicitar eliminación” desde tu historial.',
    }, { status: 403 });
  }

  const { data: current, error: currentError } = await admin
    .from('vendo_requests')
    .select('id')
    .in('id', ids);

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  const existing = current ?? [];
  if (existing.length === 0) {
    return NextResponse.json({ error: 'Las solicitudes ya no existen.' }, { status: 404 });
  }

  const existingIds = existing.map((row: any) => String(row.id));
  const { error } = await admin.from('vendo_requests').delete().in('id', existingIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, deletedIds: existingIds });
}
