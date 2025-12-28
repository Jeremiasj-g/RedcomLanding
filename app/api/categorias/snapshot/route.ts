import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const branch_key = searchParams.get('branch_key');
    const year = Number(searchParams.get('year'));
    const month = Number(searchParams.get('month'));

    if (!branch_key || !year || !month) {
      return NextResponse.json(
        { error: 'Faltan parámetros: branch_key, year, month' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('categorias_snapshots')
      .select('id, branch_key, period_year, period_month, closed_at, payload, meta')
      .eq('branch_key', branch_key)
      .eq('period_year', year)
      .eq('period_month', month)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ snapshot: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}
