export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Body = {
  branch_key: string;
  branch: string;
  period_year: number;
  period_month: number;
  payload: any;
  meta?: any;
  replace?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (
      !body?.branch_key ||
      !body?.branch ||
      !body?.period_year ||
      !body?.period_month ||
      typeof body?.payload === 'undefined'
    ) {
      return NextResponse.json({ error: 'Body incompleto', body }, { status: 400 });
    }

    if (
      !Number.isInteger(body.period_year) ||
      !Number.isInteger(body.period_month) ||
      body.period_month < 1 ||
      body.period_month > 12
    ) {
      return NextResponse.json({ error: 'Período inválido' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { error: 'Faltan env vars', hasUrl: Boolean(url), hasServiceRole: Boolean(key) },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data: existing, error: existingError } = await supabase
      .from('categorias_snapshots')
      .select('id, closed_at, meta')
      .eq('branch_key', body.branch_key)
      .eq('period_year', body.period_year)
      .eq('period_month', body.period_month)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error: existingError.message,
          code: existingError.code,
          details: (existingError as any).details ?? null,
          hint: (existingError as any).hint ?? null,
        },
        { status: 500 }
      );
    }

    if (existing && !body.replace) {
      return NextResponse.json(
        {
          error: 'Ya existe un snapshot para este período.',
          code: 'SNAPSHOT_EXISTS',
          snapshot: {
            id: existing.id,
            closed_at: existing.closed_at,
          },
        },
        { status: 409 }
      );
    }

    if (existing && body.replace) {
      const replacementMeta = {
        ...(existing.meta && typeof existing.meta === 'object' && !Array.isArray(existing.meta)
          ? existing.meta
          : {}),
        ...(body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
          ? body.meta
          : {}),
        replaced_snapshot_id: existing.id,
        previous_closed_at: existing.closed_at,
        replaced_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('categorias_snapshots')
        .update({
          branch: body.branch,
          payload: body.payload,
          meta: replacementMeta,
          closed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            details: (error as any).details ?? null,
            hint: (error as any).hint ?? null,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, id: data?.id, replaced: true });
    }

    const payloadToInsert = {
      branch_key: body.branch_key,
      branch: body.branch,
      period_year: body.period_year,
      period_month: body.period_month,
      payload: body.payload,
      meta: body.meta ?? null,
    };

    const { data, error } = await supabase
      .from('categorias_snapshots')
      .insert(payloadToInsert)
      .select('id')
      .single();

    if (error) {
      // Si otro cierre ganó la carrera entre la comprobación y el INSERT,
      // devolvemos igualmente un 409 para que la UI pueda ofrecer reemplazar.
      if (error.code === '23505') {
        return NextResponse.json(
          {
            error: 'Ya existe un snapshot para este período.',
            code: 'SNAPSHOT_EXISTS',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: (error as any).details ?? null,
          hint: (error as any).hint ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: data?.id, replaced: false });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Error desconocido' },
      { status: 500 }
    );
  }
}
