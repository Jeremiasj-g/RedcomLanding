'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  analyticsSettingKey,
  getDefaultAnalyticsUrl,
  type AnalyticsEmbedSection,
  type AnalyticsEmbedSettingRow,
  type AnalyticsScopeKey,
} from '@/lib/analytics-config';

type AnalyticsSettingsMap = Record<string, AnalyticsEmbedSettingRow>;

type AnalyticsConfigContextValue = {
  loading: boolean;
  migrationReady: boolean;
  settings: AnalyticsSettingsMap;
  getUrl: (section: AnalyticsEmbedSection, scopeKey: AnalyticsScopeKey) => string;
  getSetting: (
    section: AnalyticsEmbedSection,
    scopeKey: AnalyticsScopeKey,
  ) => AnalyticsEmbedSettingRow | null;
  refresh: () => Promise<void>;
};

const AnalyticsConfigContext = createContext<AnalyticsConfigContextValue | null>(null);

function isMissingTable(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('analytics_embed_settings')
  );
}

function rowsToMap(rows: AnalyticsEmbedSettingRow[]) {
  return rows.reduce<AnalyticsSettingsMap>((acc, row) => {
    acc[analyticsSettingKey(row.section, row.scope_key)] = row;
    return acc;
  }, {});
}

export default function AnalyticsConfigProvider({ children }: { children: React.ReactNode }) {
  const mountedRef = useRef(true);
  const [settings, setSettings] = useState<AnalyticsSettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [migrationReady, setMigrationReady] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('analytics_embed_settings')
      .select('id,section,scope_key,url,updated_by,updated_by_name,updated_at')
      .order('section', { ascending: true })
      .order('scope_key', { ascending: true });

    if (!mountedRef.current) return;

    if (error) {
      if (isMissingTable(error)) {
        setMigrationReady(false);
        setSettings({});
      } else {
        console.error('No se pudo cargar la configuración analítica:', error);
      }
      setLoading(false);
      return;
    }

    setMigrationReady(true);
    setSettings(rowsToMap((data ?? []) as AnalyticsEmbedSettingRow[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const channel = supabase
      .channel('analytics-embed-settings-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'analytics_embed_settings' },
        (payload) => {
          if (!mountedRef.current) return;

          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<AnalyticsEmbedSettingRow>;
            if (!oldRow.section || !oldRow.scope_key) return;
            const key = analyticsSettingKey(oldRow.section, oldRow.scope_key);
            setSettings((previous) => {
              const next = { ...previous };
              delete next[key];
              return next;
            });
            return;
          }

          const row = payload.new as AnalyticsEmbedSettingRow;
          if (!row.section || !row.scope_key) return;
          const key = analyticsSettingKey(row.section, row.scope_key);
          setSettings((previous) => ({ ...previous, [key]: row }));
        },
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const getSetting = useCallback(
    (section: AnalyticsEmbedSection, scopeKey: AnalyticsScopeKey) =>
      settings[analyticsSettingKey(section, scopeKey)] ?? null,
    [settings],
  );

  const getUrl = useCallback(
    (section: AnalyticsEmbedSection, scopeKey: AnalyticsScopeKey) => {
      const setting = settings[analyticsSettingKey(section, scopeKey)];
      if (setting) return String(setting.url || '').trim();
      return getDefaultAnalyticsUrl(section, scopeKey);
    },
    [settings],
  );

  const value = useMemo<AnalyticsConfigContextValue>(
    () => ({ loading, migrationReady, settings, getUrl, getSetting, refresh }),
    [getSetting, getUrl, loading, migrationReady, refresh, settings],
  );

  return (
    <AnalyticsConfigContext.Provider value={value}>
      {children}
    </AnalyticsConfigContext.Provider>
  );
}

export function useAnalyticsConfig() {
  const context = useContext(AnalyticsConfigContext);
  if (!context) {
    throw new Error('useAnalyticsConfig debe utilizarse dentro de AnalyticsConfigProvider.');
  }
  return context;
}
