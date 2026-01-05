'use client';

export default function PanelFocosStats({
  loading,
  activos,
  criticos,
  cumplimientos,
  total,
}: {
  loading?: boolean;
  activos: number;
  criticos: number;
  cumplimientos: number;
  total: number;
}) {
  const Item = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900">
        {loading ? '…' : value}
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <Item label="Focos activos" value={activos} />
      <Item label="Críticos" value={criticos} />
      <Item label="Cumplimientos" value={cumplimientos} />
      <Item label="Total focos" value={total} />
    </div>
  );
}
