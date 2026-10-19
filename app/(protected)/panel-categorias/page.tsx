'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
  Gauge,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import DualSpinner from '@/components/ui/DualSpinner';
import { RedcomSelect } from '@/components/ui/redcom-select';
import { useMe } from '@/hooks/useMe';
import {
  fetchCategoryPanelCurrent,
  replaceCategoryPanelCurrent,
  type CategoryPanelState,
} from '@/lib/categoryPanel';
import {
  parseCategoryPanelFiles,
  type CategoryPanelBranchKey,
  type CategoryPanelParseResult,
  type CategoryPanelRow,
} from '@/lib/categoryPanelExcel';
import { errorMessage, notify } from '@/lib/notifications';
import SellerConsiderations from '@/components/category-panel/SellerConsiderations';
import SingleSellerPivotUpdate from '@/components/category-panel/SingleSellerPivotUpdate';
import {
  createCategoryScaleGate,
  createCategoryScaleMetric,
  deleteCategoryScaleGate,
  deleteCategoryScaleMetric,
  fetchCategoryScaleConfig,
  updateCategoryScaleGate,
  updateCategoryScaleMetric,
  updateCategoryScaleSettings,
  type CategoryScaleGate,
  type CategoryScaleMetric,
  type CategoryScaleMetricInput,
  type CategoryScaleSettings,
  type CategoryScaleValueType,
} from '@/lib/categoryScale';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('es-AR');

const EDIT_BRANCH_OPTIONS: Array<{
  value: CategoryPanelBranchKey;
  label: string;
}> = [
  { value: 'corrientes_masivos', label: 'Corrientes' },
  { value: 'corrientes_refrigerados', label: 'Corrientes Refrigerados' },
  { value: 'chaco', label: 'Chaco' },
  { value: 'misiones', label: 'Misiones' },
  { value: 'obera', label: 'Oberá' },
];

const emptyState: CategoryPanelState = {
  lastImportedAt: null,
  lastImportedBy: null,
  rowCount: 0,
};

function dateTimeLabel(value: string | null) {
  if (!value) return 'Todavía sin actualización';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CategoryPanelPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [savedRows, setSavedRows] = useState<CategoryPanelRow[]>([]);
  const [savedState, setSavedState] = useState<CategoryPanelState>(emptyState);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const [pivotFile, setPivotFile] = useState<File | null>(null);
  const [tmpFile, setTmpFile] = useState<File | null>(null);
  const [inputVersion, setInputVersion] = useState(0);

  const [preview, setPreview] = useState<CategoryPanelParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CategoryPanelRow | null>(null);
  const [editingOriginalKey, setEditingOriginalKey] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'kpis' | 'sigo' | 'scales'>('kpis');

  useEffect(() => {
    if (meLoading) return;
    if (!me || me.role !== 'admin') {
      router.replace('/acceso-denegado?modulo=panel-categorias');
    }
  }, [me, meLoading, router]);

  useEffect(() => {
    if (meLoading || !me || me.role !== 'admin') return;

    let cancelled = false;

    void (async () => {
      try {
        setLoadingSaved(true);
        const current = await fetchCategoryPanelCurrent();
        if (cancelled) return;
        setSavedRows(current.rows);
        setSavedState(current.state);
      } catch (error) {
        if (!cancelled) {
          notify.error(
            errorMessage(
              error,
              'No se pudieron cargar los datos actuales del Panel de categorías.',
            ),
          );
        }
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, meLoading]);

  const displayRows = preview?.rows ?? savedRows;
  const displayMode = preview ? 'preview' : 'saved';

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of displayRows) map.set(row.branchKey, row.branchLabel);

    return [
      { value: 'all', label: 'Todas las sucursales' },
      ...Array.from(map.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es')),
    ];
  }, [displayRows]);

  useEffect(() => {
    if (
      branchFilter !== 'all' &&
      !branchOptions.some((option) => option.value === branchFilter)
    ) {
      setBranchFilter('all');
    }
  }, [branchFilter, branchOptions]);

  const filteredRows = useMemo(() => {
    const query = normalizeSearch(search);

    return displayRows.filter((row) => {
      if (branchFilter !== 'all' && row.branchKey !== branchFilter) return false;

      if (!query) return true;

      return normalizeSearch(
        [
          row.branchLabel,
          row.sector,
          row.sellerId,
          row.sellerName,
        ].join(' '),
      ).includes(query);
    });
  }, [branchFilter, displayRows, search]);

  const totals = useMemo(() => {
    return displayRows.reduce(
      (acc, row) => {
        acc.billing += row.importeFinalFacturado;
        acc.invoices += row.cntFac;
        return acc;
      },
      { billing: 0, invoices: 0 },
    );
  }, [displayRows]);

  const clearFiles = () => {
    setPivotFile(null);
    setTmpFile(null);
    setPreview(null);
    setInputVersion((current) => current + 1);
  };

  const processFiles = async () => {
    if (!pivotFile || !tmpFile) {
      notify.error('Seleccioná los dos reportes antes de unificar.');
      return;
    }

    try {
      setParsing(true);
      const result = await parseCategoryPanelFiles(pivotFile, tmpFile);
      setPreview(result);
      setSearch('');
      setBranchFilter('all');

      if (result.canSave) {
        notify.success(
          `Unificación lista: ${result.rows.length} vendedores para revisar.`,
        );
      } else {
        notify.error(
          'La vista previa tiene diferencias entre reportes. Revisalas antes de guardar.',
        );
      }
    } catch (error) {
      setPreview(null);
      notify.error(errorMessage(error, 'No se pudieron procesar los reportes.'));
    } finally {
      setParsing(false);
    }
  };

  const openRowEditor = (row: CategoryPanelRow) => {
    setEditingOriginalKey(`${row.branchKey}:${row.sellerId}`);
    setEditingRow({ ...row });
  };

  const closeRowEditor = () => {
    setEditingRow(null);
    setEditingOriginalKey(null);
  };

  const saveEditedRow = () => {
    if (!preview || !editingRow || !editingOriginalKey) return;

    if (
      !editingRow.sellerName.trim() ||
      editingRow.sellerId <= 0 ||
      editingRow.sector <= 0
    ) {
      notify.error('Sucursal, sector, ID y nombre del vendedor deben ser válidos.');
      return;
    }

    const branchMeta = EDIT_BRANCH_OPTIONS.find(
      (option) => option.value === editingRow.branchKey,
    );
    const nextRow: CategoryPanelRow = {
      ...editingRow,
      branchLabel: branchMeta?.label ?? editingRow.branchLabel,
      sellerName: editingRow.sellerName.trim(),
    };

    const nextRows = preview.rows.map((row) =>
      `${row.branchKey}:${row.sellerId}` === editingOriginalKey
        ? nextRow
        : row,
    );

    const counts = new Map<string, number>();
    for (const row of nextRows) {
      const key = `${row.branchKey}:${row.sellerId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const duplicateKeys = Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => key);

    setPreview({
      ...preview,
      rows: nextRows,
      duplicateKeys,
      canSave:
        nextRows.length > 0 &&
        preview.unmatchedPivot.length === 0 &&
        preview.unmatchedTmp.length === 0 &&
        duplicateKeys.length === 0,
    });

    closeRowEditor();
    notify.success('Fila actualizada en la vista previa.');
  };

  const savePreview = async () => {
    if (!preview?.canSave || saving) return;

    try {
      setSaving(true);
      const result = await replaceCategoryPanelCurrent(preview.rows);

      setSavedRows(preview.rows);
      setSavedState({
        lastImportedAt: result.importedAt,
        lastImportedBy: me?.id ?? null,
        rowCount: result.rowCount,
      });

      setConfirmSaveOpen(false);
      setPivotFile(null);
      setTmpFile(null);
      setPreview(null);
      setInputVersion((current) => current + 1);

      notify.success(
        `Datos actualizados. Se reemplazaron por ${result.rowCount} vendedores.`,
      );
    } catch (error) {
      notify.error(
        errorMessage(error, 'No se pudieron guardar los datos unificados.'),
      );
    } finally {
      setSaving(false);
    }
  };

  if (meLoading || !me || me.role !== 'admin') {
    return (
      <div className="grid min-h-[75vh] place-items-center bg-[#f4f5f7]">
        <DualSpinner size={60} thickness={4} />
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#f4f5f7] pb-16">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <section className="px-1 pb-2 pt-4 sm:px-2 sm:pt-6">
            <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">
                  <Database className="h-4 w-4" />
                  Datos operativos
                </div>

                <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#111214] sm:text-[46px]">
                  Panel de categorías
                </h1>

                <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate-500">
                  Unificá el reporte de visitas con el reporte de facturación,
                  revisá el resultado y reemplazá el estado actual guardado.
                </p>
              </div>

              <div className="grid min-w-0 gap-0 border-y border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-slate-200 xl:min-w-[600px]">
                <HeroStat
                  label="Datos guardados"
                  value={loadingSaved ? '—' : integerFormatter.format(savedState.rowCount)}
                  detail="vendedores actuales"
                />
                <HeroStat
                  label="Última actualización"
                  value={
                    savedState.lastImportedAt
                      ? new Intl.DateTimeFormat('es-AR', {
                          day: '2-digit',
                          month: 'short',
                        })
                          .format(new Date(savedState.lastImportedAt))
                          .replace('.', '')
                      : '—'
                  }
                  detail={
                    savedState.lastImportedAt
                      ? new Intl.DateTimeFormat('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(savedState.lastImportedAt))
                      : 'sin importaciones'
                  }
                />
                <HeroStat
                  label="Modo"
                  value="Reemplazo"
                  detail="no acumula históricos"
                />
              </div>
            </div>
          </section>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
            <PanelTab
              active={activeTab === 'kpis'}
              onClick={() => setActiveTab('kpis')}
              icon={<Database className="h-4 w-4" />}
              label="KPIs"
            />
            <PanelTab
              active={activeTab === 'sigo'}
              onClick={() => setActiveTab('sigo')}
              icon={<Clock3 className="h-4 w-4" />}
              label="Horarios SIGO"
            />
            <PanelTab
              active={activeTab === 'scales'}
              onClick={() => setActiveTab('scales')}
              icon={<Gauge className="h-4 w-4" />}
              label="Cuadro de escalas"
            />
          </div>

          {activeTab === 'kpis' ? (
            <>
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <UploadCard
              key={`pivot-${inputVersion}`}
              number="01"
              title="Reporte de visitas"
              subtitle="PivotGrid.xlsx"
              description="Sector, vendedor, visitados, venta a distancia, venta en PDV y visitas planeadas."
              file={pivotFile}
              onFile={setPivotFile}
              accept=".xlsx"
            />
            <UploadCard
              key={`tmp-${inputVersion}`}
              number="02"
              title="Reporte de facturación"
              subtitle="TMP / Análisis de ventas"
              description="Se utilizan únicamente Importe Final Facturado y Cnt.Fac."
              file={tmpFile}
              onFile={setTmpFile}
              accept=".xlsx"
            />
          </section>

          <section className="mt-4 flex flex-col gap-3 rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_12px_36px_rgba(15,23,42,.035)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[12px] font-semibold text-slate-800">
                  Los archivos no se almacenan
                </div>
                <p className="mt-0.5 text-[11px] leading-5 text-slate-400">
                  Se leen localmente para generar la vista previa. Al guardar,
                  solo se persisten las filas unificadas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(pivotFile || tmpFile || preview) && (
                <button
                  type="button"
                  onClick={clearFiles}
                  disabled={parsing || saving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={() => void processFiles()}
                disabled={!pivotFile || !tmpFile || parsing || saving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {parsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {parsing ? 'Unificando...' : 'Unificar reportes'}
              </button>
            </div>
          </section>

          <SingleSellerPivotUpdate
            savedRows={savedRows}
            onUpdated={(updated) =>
              setSavedRows((current) =>
                current.map((row) =>
                  row.branchKey === updated.branchKey && row.sellerId === updated.sellerId
                    ? updated
                    : row,
                ),
              )
            }
          />

          {preview ? <ValidationSummary result={preview} /> : null}

          <section className="mt-5 overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,.045)]">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div
                    className={`inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      displayMode === 'preview'
                        ? 'text-blue-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {displayMode === 'preview' ? (
                      <Upload className="h-3.5 w-3.5" />
                    ) : (
                      <Database className="h-3.5 w-3.5" />
                    )}
                    {displayMode === 'preview'
                      ? 'Vista previa · sin guardar'
                      : 'Datos actuales guardados'}
                  </div>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">
                    {displayRows.length
                      ? `${integerFormatter.format(displayRows.length)} vendedores unificados`
                      : 'Todavía no hay datos guardados'}
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {displayMode === 'preview'
                      ? 'Revisá esta tabla antes de reemplazar la información actual.'
                      : `Última actualización: ${dateTimeLabel(
                          savedState.lastImportedAt,
                        )}`}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[570px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar vendedor, ID o sector..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-[#fafbfc] pl-10 pr-3 text-[12px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                    />
                  </div>
                  <RedcomSelect
                    value={branchFilter}
                    onValueChange={setBranchFilter}
                    options={branchOptions}
                    className="h-11"
                    placeholder="Sucursal"
                  />
                </div>
              </div>

              {displayRows.length ? (
                <div className="mt-5 grid gap-0 border-y border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
                  <TableStat
                    label="Vendedores visibles"
                    value={integerFormatter.format(filteredRows.length)}
                  />
                  <TableStat
                    label="Facturación total"
                    value={currencyFormatter.format(totals.billing)}
                    compact
                  />
                  <TableStat
                    label="Cantidad de facturas"
                    value={integerFormatter.format(totals.invoices)}
                  />
                </div>
              ) : null}
            </div>

            {loadingSaved && !preview ? (
              <div className="grid min-h-[340px] place-items-center">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  Cargando datos actuales...
                </div>
              </div>
            ) : displayRows.length ? (
              <UnifiedTable
                rows={filteredRows}
                editable={Boolean(preview)}
                onEdit={openRowEditor}
              />
            ) : (
              <div className="grid min-h-[340px] place-items-center px-6 text-center">
                <div>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                    <FileSpreadsheet className="h-5 w-5" />
                  </span>
                  <div className="mt-3 text-sm font-semibold text-slate-700">
                    Importá los dos reportes para comenzar
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    La vista previa aparecerá acá antes de guardar cualquier dato.
                  </p>
                </div>
              </div>
            )}

            {preview ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-[#fafbfc] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="text-[11px] text-slate-400">
                  {preview.canSave ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Validación completa. Los dos reportes coinciden por ID.
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Corregí las diferencias antes de guardar.
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmSaveOpen(true)}
                  disabled={!preview.canSave || saving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Save className="h-4 w-4" />
                  Guardar y reemplazar datos actuales
                </button>
              </div>
            ) : null}
          </section>
            </>
          ) : activeTab === 'sigo' ? (
            <section className="mt-6 rounded-[26px] border border-slate-200/80 bg-white px-6 py-12 text-center shadow-[0_16px_45px_rgba(15,23,42,.035)]">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                <Clock3 className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.025em] text-slate-950">
                Horarios SIGO
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-[12px] leading-6 text-slate-500">
                Esta vista queda preparada como el próximo bloque del Panel de categorías.
                Acá vamos a incorporar el seguimiento de horarios y sus parámetros.
              </p>
            </section>
          ) : (
            <CategoryScaleTab />
          )}
        </div>
      </main>

      <AnimatePresence>
        {editingRow ? (
          <motion.div
            className="fixed inset-0 z-[105] grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/30 backdrop-blur-md"
              onClick={closeRowEditor}
              aria-label="Cerrar editor"
            />

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              className="relative z-10 max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-[26px] border border-white/70 bg-white p-6 shadow-[0_35px_100px_rgba(15,23,42,.25)] sm:p-7"
            >
              <button
                type="button"
                onClick={closeRowEditor}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-600">
                Ajuste manual
              </div>
              <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Editar vendedor
              </h3>
              <p className="mt-1 text-[12px] leading-5 text-slate-500">
                Los cambios se aplican únicamente a esta vista previa y serán los
                valores que se guarden al confirmar el reemplazo.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <EditorField label="Sucursal">
                  <RedcomSelect
                    value={editingRow.branchKey}
                    onValueChange={(value) =>
                      setEditingRow((current) =>
                        current
                          ? {
                              ...current,
                              branchKey: value as CategoryPanelBranchKey,
                              branchLabel:
                                EDIT_BRANCH_OPTIONS.find(
                                  (option) => option.value === value,
                                )?.label ?? current.branchLabel,
                            }
                          : current,
                      )
                    }
                    options={EDIT_BRANCH_OPTIONS}
                    className="h-11"
                  />
                </EditorField>

                <EditorField label="Sector">
                  <EditorNumberInput
                    value={editingRow.sector}
                    onChange={(value) =>
                      setEditingRow((current) =>
                        current ? { ...current, sector: value } : current,
                      )
                    }
                  />
                </EditorField>

                <EditorField label="N° vendedor">
                  <EditorNumberInput
                    value={editingRow.sellerId}
                    onChange={(value) =>
                      setEditingRow((current) =>
                        current ? { ...current, sellerId: value } : current,
                      )
                    }
                  />
                </EditorField>

                <EditorField label="Vendedor">
                  <input
                    value={editingRow.sellerName}
                    onChange={(event) =>
                      setEditingRow((current) =>
                        current
                          ? { ...current, sellerName: event.target.value }
                          : current,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-800 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  />
                </EditorField>

                <EditorField label="Visitados">
                  <EditorNumberInput
                    value={editingRow.visitados}
                    onChange={(value) =>
                      setEditingRow((current) =>
                        current ? { ...current, visitados: value } : current,
                      )
                    }
                  />
                </EditorField>

                <EditorField label="Venta a distancia">
                  <EditorNumberInput
                    value={editingRow.ventaDistancia}
                    onChange={(value) =>
                      setEditingRow((current) =>
                        current
                          ? { ...current, ventaDistancia: value }
                          : current,
                      )
                    }
                  />
                </EditorField>

                <EditorField label="Venta PDV">
                  <EditorNumberInput
                    value={editingRow.ventaPdv}
                    onChange={(value) =>
                      setEditingRow((current) =>
                        current ? { ...current, ventaPdv: value } : current,
                      )
                    }
                  />
                </EditorField>

                <EditorField label="Visitas planeadas">
                  <EditorNumberInput
                    value={editingRow.visitasPlaneadas}
                    onChange={(value) =>
                      setEditingRow((current) =>
                        current
                          ? { ...current, visitasPlaneadas: value }
                          : current,
                      )
                    }
                  />
                </EditorField>

                <EditorField label="Importe Final Facturado">
                  <EditorNumberInput
                    value={editingRow.importeFinalFacturado}
                    decimals
                    onChange={(value) =>
                      setEditingRow((current) =>
                        current
                          ? { ...current, importeFinalFacturado: value }
                          : current,
                      )
                    }
                  />
                </EditorField>

                <EditorField label="Cnt.Fac.">
                  <EditorNumberInput
                    value={editingRow.cntFac}
                    onChange={(value) =>
                      setEditingRow((current) =>
                        current ? { ...current, cntFac: value } : current,
                      )
                    }
                  />
                </EditorField>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeRowEditor}
                  className="h-10 rounded-xl px-4 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveEditedRow}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                >
                  <Save className="h-4 w-4" />
                  Aplicar cambios
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {confirmSaveOpen && preview ? (
          <motion.div
            className="fixed inset-0 z-[100] grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-md"
              onClick={() => !saving && setConfirmSaveOpen(false)}
              aria-label="Cerrar confirmación"
            />

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              className="relative z-10 w-full max-w-[480px] rounded-[24px] border border-white/70 bg-white p-6 shadow-[0_35px_100px_rgba(15,23,42,.25)]"
            >
              <button
                type="button"
                onClick={() => setConfirmSaveOpen(false)}
                disabled={saving}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>

              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                <Database className="h-5 w-5" />
              </span>

              <h3 className="mt-4 text-xl font-semibold tracking-[-0.025em] text-slate-950">
                Reemplazar datos actuales
              </h3>

              <p className="mt-2 text-[12px] leading-6 text-slate-500">
                Se eliminará el estado actual del Panel de categorías y será
                reemplazado por los{' '}
                <strong className="font-semibold text-slate-800">
                  {preview.rows.length} vendedores
                </strong>{' '}
                de esta vista previa. No se conservará una copia de las filas
                anteriores.
              </p>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmSaveOpen(false)}
                  disabled={saving}
                  className="h-10 rounded-xl px-4 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void savePreview()}
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {saving ? 'Guardando...' : 'Confirmar reemplazo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function HeroStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="px-2 py-4 sm:px-5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold tracking-[-0.035em] text-slate-950">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-400">{detail}</div>
    </div>
  );
}

function UploadCard({
  number,
  title,
  subtitle,
  description,
  file,
  onFile,
  accept,
}: {
  number: string;
  title: string;
  subtitle: string;
  description: string;
  file: File | null;
  onFile: (file: File | null) => void;
  accept: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const takeFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith('.xlsx')) {
      notify.error('El archivo debe tener formato .xlsx.');
      return;
    }
    onFile(candidate);
  };

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        takeFile(event.dataTransfer.files?.[0]);
      }}
      className={`relative overflow-hidden rounded-[24px] border bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,.035)] transition ${
        dragging
          ? 'border-blue-300 ring-4 ring-blue-100'
          : file
            ? 'border-emerald-200'
            : 'border-slate-200/80'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => takeFile(event.target.files?.[0])}
      />

      <div className="flex items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[11px] font-semibold ${
              file
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {file ? <CheckCircle2 className="h-4 w-4" /> : number}
          </span>

          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              {subtitle}
            </div>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">
              {title}
            </h3>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-slate-400">
              {description}
            </p>
          </div>
        </div>

        {file ? (
          <button
            type="button"
            onClick={() => onFile(null)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Quitar archivo"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div
        className={`mt-5 flex min-h-[72px] items-center justify-between gap-4 rounded-[16px] border border-dashed px-4 py-3 ${
          file
            ? 'border-emerald-200 bg-emerald-50/50'
            : 'border-slate-200 bg-[#fafbfc]'
        }`}
      >
        {file ? (
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-slate-700">
              {file.name}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              {fileSizeLabel(file.size)} · listo para procesar
            </div>
          </div>
        ) : (
          <div>
            <div className="text-[11px] font-medium text-slate-500">
              Arrastrá el archivo acá
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              o seleccioná un XLSX desde tu equipo
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {file ? 'Cambiar' : 'Seleccionar'}
        </button>
      </div>
    </div>
  );
}

function ValidationSummary({ result }: { result: CategoryPanelParseResult }) {
  const criticalCount =
    result.unmatchedPivot.length +
    result.unmatchedTmp.length +
    result.duplicateKeys.length;

  return (
    <section
      className={`mt-4 rounded-[22px] border px-5 py-4 ${
        criticalCount
          ? 'border-amber-200 bg-amber-50/75'
          : 'border-emerald-200 bg-emerald-50/70'
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          {criticalCount ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          )}
          <div>
            <div
              className={`text-[12px] font-semibold ${
                criticalCount ? 'text-amber-900' : 'text-emerald-900'
              }`}
            >
              {criticalCount
                ? 'Hay diferencias que requieren revisión'
                : 'Los reportes coinciden correctamente'}
            </div>
            <p
              className={`mt-1 text-[11px] leading-5 ${
                criticalCount ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              El cruce se realiza por sucursal + ID de vendedor. Los nombres se
              muestran para control visual, pero no se utilizan como clave.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
          <ValidationMetric label="Pivot" value={result.pivotCount} />
          <ValidationMetric label="TMP" value={result.tmpCount} />
          <ValidationMetric label="Unificados" value={result.rows.length} />
          <ValidationMetric
            label="Sin pareja"
            value={result.unmatchedPivot.length + result.unmatchedTmp.length}
            warning={
              result.unmatchedPivot.length + result.unmatchedTmp.length > 0
            }
          />
          <ValidationMetric
            label="Nombre distinto"
            value={result.nameMismatches.length}
            warning={false}
          />
        </div>
      </div>

      {criticalCount ? (
        <div className="mt-4 border-t border-amber-200/70 pt-3 text-[10px] leading-5 text-amber-800">
          {result.unmatchedPivot.slice(0, 4).map((item) => (
            <div key={`pivot-${item.key}`}>
              Solo en Pivot: {item.branchLabel} · ID {item.sellerId} ·{' '}
              {item.sellerName}
            </div>
          ))}
          {result.unmatchedTmp.slice(0, 4).map((item) => (
            <div key={`tmp-${item.key}`}>
              Solo en TMP: {item.branchLabel} · ID {item.sellerId} ·{' '}
              {item.sellerName}
            </div>
          ))}
          {result.duplicateKeys.slice(0, 4).map((key) => (
            <div key={`duplicate-${key}`}>ID duplicado: {key}</div>
          ))}
        </div>
      ) : result.nameMismatches.length ? (
        <div className="mt-4 border-t border-emerald-200/70 pt-3 text-[10px] leading-5 text-emerald-800">
          Hay {result.nameMismatches.length} ID
          {result.nameMismatches.length === 1 ? '' : 's'} con nombres distintos
          entre reportes. No bloquea el guardado porque el cruce se realiza por
          ID.
        </div>
      ) : null}
    </section>
  );
}

function ValidationMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div
        className={`mt-0.5 text-lg font-semibold ${
          warning ? 'text-amber-700' : 'text-slate-800'
        }`}
      >
        {integerFormatter.format(value)}
      </div>
    </div>
  );
}

function TableStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="px-1 py-3.5 sm:px-5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.09em] text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 truncate font-semibold tracking-[-0.025em] text-slate-950 ${
          compact ? 'text-lg' : 'text-2xl'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function UnifiedTable({
  rows,
  editable,
  onEdit,
}: {
  rows: CategoryPanelRow[];
  editable: boolean;
  onEdit: (row: CategoryPanelRow) => void;
}) {
  return (
    <div className="max-h-[680px] overflow-auto">
      <table className="w-full min-w-[1280px] text-left">
        <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl">
          <tr className="border-b border-slate-200 text-[9px] uppercase tracking-[0.08em] text-slate-400">
            <th className="px-5 py-3.5 font-semibold">Sucursal</th>
            <th className="px-4 py-3.5 font-semibold">Sector</th>
            <th className="px-4 py-3.5 font-semibold">N° vend.</th>
            <th className="min-w-[230px] px-4 py-3.5 font-semibold">Vendedor</th>
            <th className="px-4 py-3.5 text-right font-semibold">Visitados</th>
            <th className="px-4 py-3.5 text-right font-semibold">Venta distancia</th>
            <th className="px-4 py-3.5 text-right font-semibold">Venta PDV</th>
            <th className="px-4 py-3.5 text-right font-semibold">Visitas planeadas</th>
            <th className="px-4 py-3.5 text-right font-semibold">
              Importe Final Facturado
            </th>
            <th className="px-4 py-3.5 text-right font-semibold">Cnt.Fac.</th>
            <th className="sticky right-0 w-[72px] bg-white/95 px-4 py-3.5 text-center font-semibold">
              Acciones
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.branchKey}-${row.sellerId}`}
              className="group border-b border-slate-100 text-[12px] text-slate-600 transition hover:bg-slate-50/80 last:border-b-0"
            >
              <td className="px-5 py-3.5">
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                  {row.branchLabel}
                </span>
              </td>
              <td className="px-4 py-3.5 font-medium text-slate-500">
                {row.sector}
              </td>
              <td className="px-4 py-3.5 font-semibold text-slate-700">
                {row.sellerId}
              </td>
              <td className="px-4 py-3.5 font-semibold text-slate-800">
                {row.sellerName}
              </td>
              <td className="px-4 py-3.5 text-right">
                {integerFormatter.format(row.visitados)}
              </td>
              <td className="px-4 py-3.5 text-right">
                {integerFormatter.format(row.ventaDistancia)}
              </td>
              <td className="px-4 py-3.5 text-right">
                {integerFormatter.format(row.ventaPdv)}
              </td>
              <td className="px-4 py-3.5 text-right">
                {integerFormatter.format(row.visitasPlaneadas)}
              </td>
              <td className="px-4 py-3.5 text-right font-semibold text-slate-800">
                {currencyFormatter.format(row.importeFinalFacturado)}
              </td>
              <td className="px-4 py-3.5 text-right font-semibold text-slate-700">
                {integerFormatter.format(row.cntFac)}
              </td>
              <td className="sticky right-0 bg-white px-4 py-3.5 text-center group-hover:bg-slate-50/95">
                {editable ? (
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="mx-auto grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-slate-300 hover:bg-slate-950 hover:text-white"
                    aria-label={`Editar ${row.sellerName}`}
                    title="Editar fila"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-300">—</span>
                )}
              </td>
            </tr>
          ))}

          {!rows.length ? (
            <tr>
              <td colSpan={11} className="px-6 py-16 text-center text-sm text-slate-400">
                No hay vendedores que coincidan con los filtros actuales.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
} 

function EditorField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.09em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function EditorNumberInput({
  value,
  onChange,
  decimals = false,
}: {
  value: number;
  onChange: (value: number) => void;
  decimals?: boolean;
}) {
  return (
    <input
      type="number"
      step={decimals ? '0.01' : '1'}
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => {
        const parsed = Number(event.target.value);
        onChange(Number.isFinite(parsed) ? parsed : 0);
      }}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] tabular-nums text-slate-800 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
    />
  );
}



function PanelTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[11px] font-semibold text-white shadow-sm'
          : 'inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900'
      }
    >
      {icon}
      {label}
    </button>
  );
}

function CategoryScaleTab() {
  const [settings, setSettings] = useState<CategoryScaleSettings>({
    title: 'Escalas categorización preventa',
    validYear: 2026,
  });
  const [metrics, setMetrics] = useState<CategoryScaleMetric[]>([]);
  const [gates, setGates] = useState<CategoryScaleGate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<number | 'new' | null>(null);
  const [metricDraft, setMetricDraft] = useState<CategoryScaleMetricInput | null>(null);
  const [editingGateId, setEditingGateId] = useState<number | 'new' | null>(null);
  const [gateDraft, setGateDraft] = useState({ label: '', valueText: '', sortOrder: 100 });
  const [savingRow, setSavingRow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const config = await fetchCategoryScaleConfig();
        if (cancelled) return;
        setSettings(config.settings);
        setMetrics(config.metrics);
        setGates(config.gates);
      } catch (error) {
        if (!cancelled) {
          notify.error(errorMessage(error, 'No se pudo cargar el cuadro de escalas.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalWeight = metrics.reduce(
    (sum, metric) => sum + metric.weightPercent,
    0,
  );

  const beginMetricEdit = (metric: CategoryScaleMetric) => {
    setEditingMetricId(metric.id);
    setMetricDraft({
      sectionName: metric.sectionName,
      metricName: metric.metricName,
      valueType: metric.valueType,
      seniorValue: metric.seniorValue,
      semiSeniorValue: metric.semiSeniorValue,
      juniorValue: metric.juniorValue,
      improvementValue: metric.improvementValue,
      weightPercent: metric.weightPercent,
      sortOrder: metric.sortOrder,
    });
  };

  const beginNewMetric = () => {
    setEditingMetricId('new');
    setMetricDraft({
      sectionName: 'Nueva sección',
      metricName: '',
      valueType: 'number',
      seniorValue: null,
      semiSeniorValue: null,
      juniorValue: null,
      improvementValue: 0,
      weightPercent: 0,
      sortOrder:
        metrics.reduce((max, metric) => Math.max(max, metric.sortOrder), 0) + 10,
    });
  };

  const saveMetricDraft = async () => {
    if (!metricDraft) return;
    if (!metricDraft.sectionName.trim() || !metricDraft.metricName.trim()) {
      notify.error('Completá la sección y el nombre de la métrica.');
      return;
    }

    if (
      metricDraft.valueType !== 'currency' &&
      (metricDraft.seniorValue === null ||
        metricDraft.semiSeniorValue === null ||
        metricDraft.juniorValue === null)
    ) {
      notify.error('Completá los valores de Senior, Semi Senior y Junior.');
      return;
    }
    try {
      setSavingRow(true);
      if (editingMetricId === 'new') {
        const created = await createCategoryScaleMetric(metricDraft);
        setMetrics((current) =>
          [...current, created].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
          ),
        );
      } else if (typeof editingMetricId === 'number') {
        const updated = await updateCategoryScaleMetric(
          editingMetricId,
          metricDraft,
        );
        setMetrics((current) =>
          current
            .map((metric) => (metric.id === updated.id ? updated : metric))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
        );
      }
      setEditingMetricId(null);
      setMetricDraft(null);
      notify.success('Cuadro de escalas actualizado.');
    } catch (error) {
      notify.error(errorMessage(error, 'No se pudo guardar la métrica.'));
    } finally {
      setSavingRow(false);
    }
  };

  const beginGateEdit = (gate: CategoryScaleGate) => {
    setEditingGateId(gate.id);
    setGateDraft({
      label: gate.label,
      valueText: gate.valueText,
      sortOrder: gate.sortOrder,
    });
  };

  const beginNewGate = () => {
    setEditingGateId('new');
    setGateDraft({
      label: '',
      valueText: '',
      sortOrder: gates.reduce((max, gate) => Math.max(max, gate.sortOrder), 0) + 10,
    });
  };

  const saveGateDraft = async () => {
    if (!gateDraft.label.trim() || !gateDraft.valueText.trim()) {
      notify.error('Completá el parámetro y su valor.');
      return;
    }
    try {
      setSavingRow(true);
      if (editingGateId === 'new') {
        const created = await createCategoryScaleGate(gateDraft);
        setGates((current) =>
          [...current, created].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
          ),
        );
      } else if (typeof editingGateId === 'number') {
        const updated = await updateCategoryScaleGate(editingGateId, gateDraft);
        setGates((current) =>
          current
            .map((gate) => (gate.id === updated.id ? updated : gate))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
        );
      }
      setEditingGateId(null);
      notify.success('Requisito actualizado.');
    } catch (error) {
      notify.error(errorMessage(error, 'No se pudo guardar el requisito.'));
    } finally {
      setSavingRow(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          Cargando cuadro de escalas...
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,.04)]">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">
                Configuración de categorización
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-slate-950">
                {settings.title}
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-slate-500">
                Adaptado del cuadro preventa. Todo puede modificarse sin tocar código.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Año
                </span>
                <input
                  type="number"
                  value={settings.validYear}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      validYear: Number(event.target.value),
                    }))
                  }
                  className="h-10 w-24 rounded-xl border border-slate-200 bg-[#fafbfc] px-3 text-[12px] outline-none"
                />
              </label>
              <label className="w-[250px]">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Título
                </span>
                <input
                  value={settings.title}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-[#fafbfc] px-3 text-[12px] outline-none"
                />
              </label>
              <button
                type="button"
                disabled={savingSettings}
                onClick={() =>
                  void (async () => {
                    try {
                      setSavingSettings(true);
                      await updateCategoryScaleSettings(settings);
                      notify.success('Configuración actualizada.');
                    } catch (error) {
                      notify.error(
                        errorMessage(error, 'No se pudo guardar la configuración.'),
                      );
                    } finally {
                      setSavingSettings(false);
                    }
                  })()
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[11px] font-semibold text-white"
              >
                {savingSettings ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-0 border-y border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
            <ScaleSummary label="Métricas" value={String(metrics.length)} />
            <ScaleSummary
              label="Peso total"
              value={String(totalWeight).replace('.', ',') + '%'}
              warning={Math.abs(totalWeight - 100) > 0.001}
            />
            <ScaleSummary label="Puertas de apertura" value={String(gates.length)} />
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                Cuadro preventa
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Senior · Semi Senior · Junior · Plan de Mejora
              </div>
            </div>
            <button
              type="button"
              onClick={beginNewMetric}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[11px] font-semibold text-slate-700 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Agregar métrica
            </button>
          </div>

          <div className="overflow-x-auto rounded-[18px] border border-slate-200">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="bg-[#f7f8fa] text-[9px] uppercase tracking-[0.08em] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sección</th>
                  <th className="px-4 py-3 font-semibold">Métrica / KPI</th>
                  <th className="bg-emerald-900 px-4 py-3 font-semibold text-white">Senior</th>
                  <th className="bg-emerald-200 px-4 py-3 font-semibold text-emerald-950">Semi Senior</th>
                  <th className="bg-amber-200 px-4 py-3 font-semibold text-amber-950">Junior</th>
                  <th className="bg-rose-200 px-4 py-3 font-semibold text-rose-950">Plan Mejora</th>
                  <th className="px-4 py-3 text-right font-semibold">Peso</th>
                  <th className="px-4 py-3 text-center font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {editingMetricId === 'new' && metricDraft ? (
                  <ScaleEditRow
                    draft={metricDraft}
                    setDraft={setMetricDraft}
                    saving={savingRow}
                    onSave={saveMetricDraft}
                    onCancel={() => {
                      setEditingMetricId(null);
                      setMetricDraft(null);
                    }}
                  />
                ) : null}

                {metrics.map((metric) =>
                  editingMetricId === metric.id && metricDraft ? (
                    <ScaleEditRow
                      key={metric.id}
                      draft={metricDraft}
                      setDraft={setMetricDraft}
                      saving={savingRow}
                      onSave={saveMetricDraft}
                      onCancel={() => {
                        setEditingMetricId(null);
                        setMetricDraft(null);
                      }}
                    />
                  ) : (
                    <tr
                      key={metric.id}
                      className="border-t border-slate-100 text-[11px] text-slate-600"
                    >
                      <td className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-400">
                        {metric.sectionName}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {metric.metricName}
                      </td>
                      <ScaleValueCell
                        tone="senior"
                        value={metric.seniorValue}
                        valueType={metric.valueType}
                      />
                      <ScaleValueCell
                        tone="semi"
                        value={metric.semiSeniorValue}
                        valueType={metric.valueType}
                      />
                      <ScaleValueCell
                        tone="junior"
                        value={metric.juniorValue}
                        valueType={metric.valueType}
                      />
                      <ScaleValueCell
                        tone="improvement"
                        value={metric.improvementValue}
                        valueType={metric.valueType}
                      />
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-800">
                        {metric.weightPercent}%
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => beginMetricEdit(metric)}
                            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void (async () => {
                                if (!window.confirm('¿Eliminar esta métrica?')) return;
                                try {
                                  await deleteCategoryScaleMetric(metric.id);
                                  setMetrics((current) =>
                                    current.filter((item) => item.id !== metric.id),
                                  );
                                } catch (error) {
                                  notify.error(
                                    errorMessage(error, 'No se pudo eliminar la métrica.'),
                                  );
                                }
                              })()
                            }
                            className="grid h-8 w-8 place-items-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_40px_rgba(15,23,42,.035)] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-600">
              Puertas de apertura
            </div>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-slate-950">
              Parámetros necesarios para categorizar
            </h3>
          </div>
          <button
            type="button"
            onClick={beginNewGate}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[11px] font-semibold text-slate-700"
          >
            <Plus className="h-4 w-4" />
            Agregar requisito
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {editingGateId === 'new' ? (
            <GateEditCard
              draft={gateDraft}
              setDraft={setGateDraft}
              saving={savingRow}
              onSave={saveGateDraft}
              onCancel={() => setEditingGateId(null)}
            />
          ) : null}

          {gates.map((gate) =>
            editingGateId === gate.id ? (
              <GateEditCard
                key={gate.id}
                draft={gateDraft}
                setDraft={setGateDraft}
                saving={savingRow}
                onSave={saveGateDraft}
                onCancel={() => setEditingGateId(null)}
              />
            ) : (
              <div
                key={gate.id}
                className="flex items-center justify-between gap-4 rounded-[18px] border border-slate-200 bg-[#fafbfc] px-4 py-4"
              >
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {gate.label}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-slate-950">
                    {gate.valueText}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => beginGateEdit(gate)}
                    className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        if (!window.confirm('¿Eliminar este requisito?')) return;
                        try {
                          await deleteCategoryScaleGate(gate.id);
                          setGates((current) =>
                            current.filter((item) => item.id !== gate.id),
                          );
                        } catch (error) {
                          notify.error(
                            errorMessage(error, 'No se pudo eliminar el requisito.'),
                          );
                        }
                      })()
                    }
                    className="grid h-8 w-8 place-items-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      <SellerConsiderations metrics={metrics} gates={gates} />
    </div>
  );
}

function ScaleSummary({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="px-2 py-3.5 sm:px-5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>
      <div
        className={
          warning
            ? 'mt-1 text-2xl font-semibold text-amber-600'
            : 'mt-1 text-2xl font-semibold text-slate-950'
        }
      >
        {value}
      </div>
    </div>
  );
}

function ScaleEditRow({
  draft,
  setDraft,
  saving,
  onSave,
  onCancel,
}: {
  draft: CategoryScaleMetricInput;
  setDraft: React.Dispatch<React.SetStateAction<CategoryScaleMetricInput | null>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const textField = (key: 'sectionName' | 'metricName') => (
    <input
      type="text"
      value={draft[key]}
      onChange={(event) =>
        setDraft((current) =>
          current ? { ...current, [key]: event.target.value } : current,
        )
      }
      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] text-slate-700 outline-none focus:border-slate-400"
    />
  );

  const numberField = (
    key:
      | 'seniorValue'
      | 'semiSeniorValue'
      | 'juniorValue'
      | 'improvementValue'
      | 'weightPercent',
  ) => (
    <input
      type="number"
      step="0.01"
      value={draft[key] ?? ''}
      placeholder="—"
      onChange={(event) => {
        const raw = event.target.value;
        setDraft((current) =>
          current
            ? {
                ...current,
                [key]: raw === '' ? null : Number(raw),
              }
            : current,
        );
      }}
      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] tabular-nums text-slate-700 outline-none focus:border-slate-400"
    />
  );

  return (
    <tr className="border-t border-blue-100 bg-blue-50/40">
      <td className="px-2 py-2">{textField('sectionName')}</td>
      <td className="px-2 py-2">
        {textField('metricName')}
        <select
          value={draft.valueType}
          onChange={(event) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    valueType: event.target.value as CategoryScaleValueType,
                  }
                : current,
            )
          }
          className="mt-1.5 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[9px] text-slate-500 outline-none"
        >
          <option value="number">Número</option>
          <option value="percent">Porcentaje</option>
          <option value="count">Cantidad</option>
          <option value="currency">Importe</option>
        </select>
      </td>
      <td className="bg-emerald-900/10 px-2 py-2">{numberField('seniorValue')}</td>
      <td className="bg-emerald-100 px-2 py-2">{numberField('semiSeniorValue')}</td>
      <td className="bg-amber-100 px-2 py-2">{numberField('juniorValue')}</td>
      <td className="bg-rose-100 px-2 py-2">{numberField('improvementValue')}</td>
      <td className="px-2 py-2">{numberField('weightPercent')}</td>
      <td className="px-2 py-2">
        <div className="flex justify-center gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ScaleValueCell({
  tone,
  value,
  valueType,
}: {
  tone: 'senior' | 'semi' | 'junior' | 'improvement';
  value: number | null;
  valueType: CategoryScaleValueType;
}) {
  const classes = {
    senior: 'bg-emerald-900 text-white',
    semi: 'bg-emerald-200 text-emerald-950',
    junior: 'bg-amber-200 text-amber-950',
    improvement: 'bg-rose-200 text-rose-950',
  };

  let formatted = '—';
  if (value !== null) {
    if (valueType === 'currency') {
      formatted = currencyFormatter.format(value);
    } else {
      formatted = Number.isInteger(value)
        ? integerFormatter.format(value)
        : value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
    }
  }

  return (
    <td className={`px-4 py-3.5 text-center text-[13px] font-semibold tabular-nums ${classes[tone]}`}>
      {formatted}
    </td>
  );
}

function GateEditCard({
  draft,
  setDraft,
  saving,
  onSave,
  onCancel,
}: {
  draft: { label: string; valueText: string; sortOrder: number };
  setDraft: React.Dispatch<
    React.SetStateAction<{ label: string; valueText: string; sortOrder: number }>
  >;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-blue-200 bg-blue-50/40 p-4">
      <input
        value={draft.label}
        onChange={(event) =>
          setDraft((current) => ({ ...current, label: event.target.value }))
        }
        placeholder="Parámetro"
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] outline-none"
      />
      <input
        value={draft.valueText}
        onChange={(event) =>
          setDraft((current) => ({ ...current, valueText: event.target.value }))
        }
        placeholder="Valor requerido"
        className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] outline-none"
      />
      <div className="mt-3 flex justify-end gap-1">
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="h-8 rounded-lg px-3 text-[10px] font-semibold text-slate-500"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-[10px] font-semibold text-white"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar
        </button>
      </div>
    </div>
  );
}
