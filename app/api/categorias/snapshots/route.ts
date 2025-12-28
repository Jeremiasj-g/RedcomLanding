import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ✅ service role (como tu opción A)
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branch_key = searchParams.get('branch_key');

    if (!branch_key) {
      return NextResponse.json({ error: 'Falta branch_key' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('categorias_snapshots')
      .select('id, branch_key, period_year, period_month, closed_at, closed_by')
      .eq('branch_key', branch_key)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .order('closed_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ snapshots: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}
