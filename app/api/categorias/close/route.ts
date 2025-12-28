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

    // ✅ Validación env vars
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { error: 'Faltan env vars', hasUrl: Boolean(url), hasServiceRole: Boolean(key) },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

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
      // 👇 devolvemos todo lo útil para debug
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

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Error desconocido' },
      { status: 500 }
    );
  }
}
