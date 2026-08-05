'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Flame,
  LayoutDashboard,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useAnalyticsConfig } from '@/components/analytics/AnalyticsConfigProvider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DualSpinner from '@/components/ui/DualSpinner';
import {
  ANALYTICS_SCOPE_DEFINITIONS,
  analyticsSettingKey,
  getScopesForSection,
  type AnalyticsEmbedSection,
  type AnalyticsScopeKey,
} from '@/lib/analytics-config';
import { errorMessage, notify } from '@/lib/notifications';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

type SectionDefinition = {
  key: AnalyticsEmbedSection;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const SECTIONS: SectionDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboards',
    shortLabel: 'Dashboards',
    description: 'Enlaces de Looker Studio utilizados en la vista principal de cada sucursal.',
    icon: BarChart3,
  },
  {
    key: 'heatmap',
    label: 'Mapas de calor',
    shortLabel: 'Mapas de calor',
    description: 'Enlaces territoriales y mapas de calor embebidos en las páginas comerciales.',
    icon: Flame,
  },
  {
    key: 'workbook',
    label: 'Tableros',
    shortLabel: 'Tableros',
    description: 'Enlaces embebidos de Excel/OneDrive que se abren desde las tarjetas de tablero.',
    icon: LayoutDashboard,
  },
];

function formatDate(value?: string | null) {
  if (!value) return 'Sin actualizaciones registradas';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin actualizaciones registradas';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function validateUrl(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'La URL debe comenzar con http:// o https://.';
    }
    return null;
  } catch {
    return 'Ingresá una URL válida.';
  }
}

function buildDrafts(getUrl: (section: AnalyticsEmbedSection, scope: AnalyticsScopeKey) => string) {
  const next: Record<string, string> = {};
  SECTIONS.forEach((section) => {
    getScopesForSection(section.key).forEach((scope) => {
      next[analyticsSettingKey(section.key, scope.key)] = getUrl(section.key, scope.key);
    });
  });
  return next;
}

export default function AdminAnalyticsSettingsPage() {
  const { me } = useAuth();
  const { loading, migrationReady, getUrl, getSetting, refresh } = useAnalyticsConfig();
  const [activeSection, setActiveSection] = useState<AnalyticsEmbedSection>('dashboard');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (loading || dirtyKeys.size > 0) return;
    setDrafts(buildDrafts(getUrl));
  }, [dirtyKeys.size, getUrl, loading]);

  const totalEntries = useMemo(
    () => SECTIONS.reduce((total, section) => total + getScopesForSection(section.key).length, 0),
    [],
  );

  const configuredEntries = useMemo(
    () =>
      SECTIONS.reduce(
        (total, section) =>
          total +
          getScopesForSection(section.key).filter((scope) =>
            Boolean((drafts[analyticsSettingKey(section.key, scope.key)] ?? getUrl(section.key, scope.key)).trim()),
          ).length,
        0,
      ),
    [drafts, getUrl],
  );

  const sectionCounts = useMemo(
    () =>
      Object.fromEntries(
        SECTIONS.map((section) => {
          const scopes = getScopesForSection(section.key);
          const configured = scopes.filter((scope) =>
            Boolean((drafts[analyticsSettingKey(section.key, scope.key)] ?? getUrl(section.key, scope.key)).trim()),
          ).length;
          return [section.key, { total: scopes.length, configured }];
        }),
      ) as Record<AnalyticsEmbedSection, { total: number; configured: number }>,
    [drafts, getUrl],
  );

  const updateDraft = (
    section: AnalyticsEmbedSection,
    scopeKey: AnalyticsScopeKey,
    value: string,
  ) => {
    const key = analyticsSettingKey(section, scopeKey);
    setDrafts((previous) => ({ ...previous, [key]: value }));
    setDirtyKeys((previous) => {
      const next = new Set(previous);
      if (value.trim() === getUrl(section, scopeKey).trim()) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      setDirtyKeys(new Set());
      setDrafts(buildDrafts(getUrl));
      notify.success('Configuración analítica actualizada.');
    } finally {
      setRefreshing(false);
    }
  };

  const saveChanges = async () => {
    if (!dirtyKeys.size) {
      notify.info('No hay cambios pendientes para guardar.');
      return;
    }

    const invalid = Array.from(dirtyKeys)
      .map((key) => ({ key, error: validateUrl(drafts[key] ?? '') }))
      .find((item) => item.error);

    if (invalid?.error) {
      notify.error(invalid.error);
      return;
    }

    setSaving(true);
    try {
      const rows = Array.from(dirtyKeys).map((key) => {
        const [section, scopeKey] = key.split(':') as [
          AnalyticsEmbedSection,
          AnalyticsScopeKey,
        ];
        return {
          section,
          scope_key: scopeKey,
          url: (drafts[key] ?? '').trim(),
          updated_by: me?.id ?? null,
          updated_by_name: me?.full_name || me?.email || null,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from('analytics_embed_settings')
        .upsert(rows, { onConflict: 'section,scope_key' });

      if (error) throw error;

      setDirtyKeys(new Set());
      await refresh();
      notify.success(
        rows.length === 1
          ? 'La URL se reemplazó correctamente.'
          : `Se actualizaron ${rows.length} URLs correctamente.`,
      );
    } catch (error) {
      notify.error(
        errorMessage(
          error,
          'No se pudo guardar la configuración analítica. Revisá la migración y los permisos.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && !Object.keys(drafts).length) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <DualSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="mb-3 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            Enlaces embebidos
          </Badge>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Configuración de analítica
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Actualizá dashboards, mapas de calor y tableros sin modificar el código. Cada
            guardado reemplaza la URL anterior y queda disponible para toda la aplicación.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || saving}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
            Actualizar
          </Button>
          <Button
            type="button"
            onClick={saveChanges}
            disabled={saving || dirtyKeys.size === 0 || !migrationReady}
            className="bg-slate-950 text-white hover:bg-slate-800"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar cambios
            {dirtyKeys.size > 0 && (
              <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs">
                {dirtyKeys.size}
              </span>
            )}
          </Button>
        </div>
      </header>

      {!migrationReady && (
        <Alert variant="destructive">
          <LayoutDashboard className="h-4 w-4" />
          <AlertTitle>Falta crear la configuración en Supabase</AlertTitle>
          <AlertDescription>
            Ejecutá <strong>CONFIGURACION_ANALITICA_BD.sql</strong> en el SQL Editor. Hasta
            entonces se seguirán utilizando los enlaces actuales incluidos como respaldo.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-semibold text-slate-500">URLs configuradas</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{configuredEntries}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-semibold text-slate-500">Sin URL</p>
              <p className="mt-1 text-3xl font-black text-slate-950">
                {totalEntries - configuredEntries}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <Link2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-semibold text-slate-500">Cambios pendientes</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{dirtyKeys.size}</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3 text-sky-600">
              <Save className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/70">
          <CardTitle className="text-lg">Enlaces activos</CardTitle>
          <CardDescription>
            Dejá un campo vacío para mostrar el estado “Visualización no disponible”.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs
            value={activeSection}
            onValueChange={(value) => setActiveSection(value as AnalyticsEmbedSection)}
          >
            <div className="border-b border-slate-200 px-4 pt-4 sm:px-6">
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-slate-100 p-1 lg:w-[620px]">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const count = sectionCounts[section.key];
                  return (
                    <TabsTrigger
                      key={section.key}
                      value={section.key}
                      className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{section.shortLabel}</span>
                      <Badge variant="secondary" className="ml-1 bg-slate-200/70 text-[10px]">
                        {count.configured}/{count.total}
                      </Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {SECTIONS.map((section) => {
              const SectionIcon = section.icon;
              return (
              <TabsContent key={section.key} value={section.key} className="m-0">
                <section className="p-4 sm:p-6">
                  <div className="mb-5">
                    <div className="flex items-center gap-2">
                      <SectionIcon className="h-5 w-5 text-slate-700" />
                      <h2 className="text-lg font-black text-slate-950">{section.label}</h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                  </div>

                  <div className="grid gap-4">
                    {getScopesForSection(section.key).map((scope) => {
                      const key = analyticsSettingKey(section.key, scope.key);
                      const value = drafts[key] ?? getUrl(section.key, scope.key);
                      const setting = getSetting(section.key, scope.key);
                      const validationError = validateUrl(value);
                      const dirty = dirtyKeys.has(key);

                      return (
                        <div
                          key={key}
                          className={cn(
                            'rounded-2xl border bg-white p-4 transition sm:p-5',
                            dirty
                              ? 'border-sky-300 shadow-[0_0_0_3px_rgba(14,165,233,0.08)]'
                              : 'border-slate-200',
                          )}
                        >
                          <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_auto] xl:items-start">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-black text-slate-950">{scope.label}</h3>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px]',
                                    value.trim()
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-amber-200 bg-amber-50 text-amber-700',
                                  )}
                                >
                                  {value.trim() ? 'Configurado' : 'Sin URL'}
                                </Badge>
                                {dirty && (
                                  <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">
                                    Modificado
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {scope.description}
                              </p>
                              <p className="mt-3 text-[11px] leading-5 text-slate-400">
                                {setting?.updated_by_name
                                  ? `Última carga: ${formatDate(setting.updated_at)} · por ${setting.updated_by_name}`
                                  : formatDate(setting?.updated_at)}
                              </p>
                            </div>

                            <div className="min-w-0 space-y-2">
                              <Label htmlFor={key} className="text-xs font-bold text-slate-600">
                                URL embebida
                              </Label>
                              <Input
                                id={key}
                                value={value}
                                onChange={(event) =>
                                  updateDraft(section.key, scope.key, event.target.value)
                                }
                                placeholder="https://..."
                                className={cn(
                                  'h-11 w-full font-mono text-xs',
                                  validationError && 'border-red-400 focus-visible:ring-red-300',
                                )}
                              />
                              {validationError && (
                                <p className="text-xs font-medium text-red-600">{validationError}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 xl:pt-6">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                title="Abrir enlace"
                                disabled={!value.trim() || Boolean(validationError)}
                                onClick={() => window.open(value.trim(), '_blank', 'noopener,noreferrer')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                title="Quitar URL"
                                disabled={!value}
                                onClick={() => updateDraft(section.key, scope.key, '')}
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </TabsContent>
              );
            })}
          </Tabs>

          <Separator />
          <div className="flex flex-col gap-3 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs leading-5 text-slate-500">
              No se guarda historial: la nueva URL reemplaza definitivamente a la anterior.
            </p>
            <Button
              type="button"
              onClick={saveChanges}
              disabled={saving || dirtyKeys.size === 0 || !migrationReady}
              className="bg-slate-950 text-white hover:bg-slate-800"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
