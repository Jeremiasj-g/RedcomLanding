'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
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
  type CategoryPanelParseResult,
  type CategoryPanelRow,
} from '@/lib/categoryPanelExcel';
import { errorMessage, notify } from '@/lib/notifications';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('es-AR');

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

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');

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
              <UnifiedTable rows={filteredRows} />
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
        </div>
      </main>

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

function UnifiedTable({ rows }: { rows: CategoryPanelRow[] }) {
  return (
    <div className="max-h-[680px] overflow-auto">
      <table className="w-full min-w-[1220px] text-left">
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
            <th className="px-5 py-3.5 text-right font-semibold">Cnt.Fac.</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.branchKey}-${row.sellerId}`}
              className="border-b border-slate-100 text-[12px] text-slate-600 transition hover:bg-slate-50/80 last:border-b-0"
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
              <td className="px-5 py-3.5 text-right font-semibold text-slate-700">
                {integerFormatter.format(row.cntFac)}
              </td>
            </tr>
          ))}

          {!rows.length ? (
            <tr>
              <td colSpan={10} className="px-6 py-16 text-center text-sm text-slate-400">
                No hay vendedores que coincidan con los filtros actuales.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
