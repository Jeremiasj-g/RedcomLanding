import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildHistoryForSeller,
  buildSellerCatalog,
  makePeriod,
  normalizeSnapshots,
  summarizeHistory,
  type CategoriaSnapshotRow,
} from '@/utils/categoriaHistory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_BRANCHES = new Set([
  'corrientes_masivos',
  'corrientes_refrigerados',
  'chaco_masivos',
  'misiones_masivos',
  'obera_masivos',
]);

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Faltan variables de entorno de Supabase');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchKey = searchParams.get('branch_key')?.trim() ?? '';
    const sellerId = searchParams.get('seller_id')?.trim() ?? '';
    const from = searchParams.get('from')?.trim() || null;
    const to = searchParams.get('to')?.trim() || null;
    const ranking = searchParams.get('ranking') === '1';

    if (!branchKey) {
      return NextResponse.json({ error: 'Falta branch_key' }, { status: 400 });
    }

    if (!VALID_BRANCHES.has(branchKey)) {
      return NextResponse.json({ error: `branch_key inválido: ${branchKey}` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const query = supabase
      .from('categorias_snapshots')
      .select('id, branch_key, branch, period_year, period_month, closed_at, payload')
      .eq('branch_key', branchKey)
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true })
      .order('closed_at', { ascending: false });

    const { data, error } = await query;

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

    const snapshots = normalizeSnapshots((data ?? []) as CategoriaSnapshotRow[]);
    const periods = snapshots.map((snapshot) => ({
      value: makePeriod(Number(snapshot.period_year), Number(snapshot.period_month)),
      year: Number(snapshot.period_year),
      month: Number(snapshot.period_month),
      closedAt: snapshot.closed_at ?? null,
      snapshotId: snapshot.id,
    }));

    const sellers = buildSellerCatalog(snapshots);

    if (ranking) {
      const rankingRows = sellers
        .map((seller) => {
          const history = buildHistoryForSeller({
            snapshots,
            branchKey,
            sellerId: seller.id,
            from,
            to,
          });

          const summary = summarizeHistory(history);
          if (!summary || !history.length) return null;

          return {
            sellerId: seller.id,
            sellerName: summary.sellerName,
            sellerCatalogName: seller.name,
            months: history.length,
            history,
            summary,
          };
        })
        .filter(Boolean);

      return NextResponse.json({
        branchKey,
        periods,
        sellers,
        history: [],
        summary: null,
        ranking: rankingRows,
      });
    }

    if (!sellerId) {
      return NextResponse.json({
        branchKey,
        periods,
        sellers,
        history: [],
        summary: null,
      });
    }

    const history = buildHistoryForSeller({
      snapshots,
      branchKey,
      sellerId,
      from,
      to,
    });

    return NextResponse.json({
      branchKey,
      periods,
      sellers,
      history,
      summary: summarizeHistory(history),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error desconocido' }, { status: 500 });
  }
}
