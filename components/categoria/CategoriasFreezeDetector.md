'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getBranchKeyFromPath } from '@/utils/branchFromPath';
import { SHEETDB_ENDPOINTS } from '@/utils/sheetdbEndpoints';

type Props = { sheetName?: string; debugLabel?: string };

function safeJsonStringify(value: any) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function approxBytesOfJson(value: any) {
  const s = safeJsonStringify(value);
  if (!s) return null;
  // aprox: 1 char ~ 1 byte para ascii; suficiente para debug
  return s.length;
}

function summarizeArrayPayload(arr: any[]) {
  const first = arr?.[0];
  const keys = first && typeof first === 'object' ? Object.keys(first) : [];
  return {
    isArray: Array.isArray(arr),
    length: Array.isArray(arr) ? arr.length : 0,
    sampleKeys: keys.slice(0, 25),
    sampleFirstRow: first ?? null,
  };
}

export default function CategoriasFreezeDetector({
  sheetName = '',
  debugLabel = 'CategoriasFreezeDetector',
}: Props) {
  const pathname = usePathname();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  // error general (fetch api / guardar)
  const [error, setError] = useState<string | null>(null);

  // debug extra
  const [debug, setDebug] = useState<any>(null);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const detected = useMemo(() => {
    const branchKey = getBranchKeyFromPath(pathname);
    if (!branchKey) {
      return { pathname, branchKey: null as any, url: null as string | null, reason: 'Ruta no mapeada' };
    }

    const endpointBase = SHEETDB_ENDPOINTS[branchKey];
    if (!endpointBase || !endpointBase.trim()) {
      return { pathname, branchKey, url: null, reason: 'Endpoint vacío' };
    }

    const url = sheetName
      ? `${endpointBase}?sheet=${encodeURIComponent(sheetName)}`
      : endpointBase;

    return { pathname, branchKey, url, reason: null as string | null };
  }, [pathname, sheetName]);

  // ======================
  // FETCH SheetDB payload
  // ======================
  useEffect(() => {
    if (!detected.url) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      setSaveMsg(null);

      const t0 = performance.now();

      console.groupCollapsed(`[${debugLabel}] FETCH SheetDB`);
      console.log('pathname =>', detected.pathname);
      console.log('branchKey =>', detected.branchKey);
      console.log('url =>', detected.url);

      try {
        const res = await fetch(detected.url, { cache: 'no-store' });

        console.log('status =>', res.status, res.statusText);
        console.log('headers =>', Object.fromEntries(res.headers.entries()));

        const text = await res.text();

        console.log('raw text length =>', text.length);
        // intentamos parsear
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch (parseErr) {
          console.warn('JSON parse failed. First 400 chars =>', text.slice(0, 400));
          throw new Error(`SheetDB devolvió texto no-JSON (status ${res.status})`);
        }

        if (!res.ok) {
          console.warn('SheetDB response json =>', json);
          throw new Error(`SheetDB HTTP ${res.status}`);
        }

        setData(json);

        const ms = Math.round(performance.now() - t0);
        const size = approxBytesOfJson(json);

        const summary = Array.isArray(json) ? summarizeArrayPayload(json) : { isArray: false, type: typeof json };

        const dbg = {
          sheetdb: {
            url: detected.url,
            status: res.status,
            ms,
            approxBytes: size,
            summary,
          },
        };

        console.log('summary =>', summary);
        console.log('approxBytes =>', size);
        console.log(`done in ${ms}ms`);
        setDebug((prev: any) => ({ ...(prev ?? {}), ...dbg }));
      } catch (e: any) {
        console.error('FETCH error =>', e);
        setError(e?.message ?? 'Error');
        setData(null);

        setDebug((prev: any) => ({
          ...(prev ?? {}),
          sheetdb: {
            url: detected.url,
            error: e?.message ?? String(e),
          },
        }));
      } finally {
        console.groupEnd();
        setLoading(false);
      }
    };

    run();
  }, [detected.url, detected.pathname, detected.branchKey, debugLabel]);

  // ======================
  // POST close month
  // ======================
  const handleCloseMonth = async () => {
    if (!detected.branchKey) return;
    if (!data) return;

    setSaving(true);
    setSaveMsg(null);
    setError(null);

    const now = new Date();
    const period_year = now.getFullYear();
    const period_month = now.getMonth() + 1;

    // payload debug
    const payloadSize = approxBytesOfJson(data);
    const payloadSummary = Array.isArray(data) ? summarizeArrayPayload(data) : { isArray: false, type: typeof data };

    const body = {
      branch_key: detected.branchKey,
      branch: String(detected.branchKey),
      period_year,
      period_month,
      payload: data,
      meta: {
        source_url: detected.url,
        pathname: detected.pathname,
        client_ts: new Date().toISOString(),
        payload_debug: {
          approxBytes: payloadSize,
          summary: payloadSummary,
        },
      },
    };

    console.groupCollapsed(`[${debugLabel}] POST /api/categorias/close`);
    console.log('request meta =>', {
      branch_key: body.branch_key,
      branch: body.branch,
      period_year: body.period_year,
      period_month: body.period_month,
      payloadApproxBytes: payloadSize,
      payloadSummary,
    });

    try {
      const t0 = performance.now();

      const res = await fetch('/api/categorias/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const ms = Math.round(performance.now() - t0);

      console.log('status =>', res.status, res.statusText);
      console.log('headers =>', Object.fromEntries(res.headers.entries()));

      // Leemos texto crudo SIEMPRE para debug
      const raw = await res.text();
      console.log('raw length =>', raw.length);
      console.log('raw preview =>', raw.slice(0, 600));

      // Intentamos parsear JSON
      let out: any = null;
      try {
        out = raw ? JSON.parse(raw) : null;
      } catch (parseErr) {
        console.warn('Response is not JSON (parse failed).');
      }

      console.log('parsed json =>', out);

      // Guardamos debug en estado
      setDebug((prev: any) => ({
        ...(prev ?? {}),
        close: {
          request: {
            branch_key: body.branch_key,
            period_year,
            period_month,
            payloadApproxBytes: payloadSize,
            payloadSummary,
          },
          response: {
            status: res.status,
            statusText: res.statusText,
            ms,
            rawPreview: raw.slice(0, 1200),
            json: out,
          },
        },
      }));

      if (!res.ok) {
        // armamos un error lo más informativo posible
        const backendMsg =
          out?.error ||
          out?.message ||
          (typeof out === 'string' ? out : null);

        const backendCode = out?.code ? ` (${out.code})` : '';
        const details = out?.details ? ` | details: ${out.details}` : '';
        const hint = out?.hint ? ` | hint: ${out.hint}` : '';

        throw new Error(
          backendMsg
            ? `Backend error: ${backendMsg}${backendCode}${details}${hint}`
            : `HTTP ${res.status} ${res.statusText} | raw: ${raw.slice(0, 300)}`
        );
      }

      setSaveMsg(`Mes cerrado guardado: ${period_month}/${period_year} (${ms}ms)`);
      console.log('OK =>', out);
    } catch (e: any) {
      console.error('CLOSE error =>', e);
      setError(e?.message ?? 'Error guardando');
      setSaveMsg(null);
    } finally {
      console.groupEnd();
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 text-xs space-y-3">
      <div className="font-bold text-slate-900">Detector + Cerrar mes (debug)</div>

      <div><b>Ruta:</b> {detected.pathname}</div>
      <div><b>Branch:</b> {String(detected.branchKey ?? '—')}</div>
      <div className="break-all"><b>API:</b> {detected.url ?? '—'}</div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCloseMonth}
          disabled={!data || saving || loading || !!detected.reason}
          className="rounded-md bg-slate-900 text-white px-3 py-2 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Cerrar mes'}
        </button>
      </div>

      {detected.reason && <div className="text-red-600">{detected.reason}</div>}
      {loading && <div className="text-slate-600">Cargando…</div>}
      {error && <div className="text-red-600"><b>Error:</b> {error}</div>}
      {saveMsg && <div className="text-emerald-700"><b>OK:</b> {saveMsg}</div>}

      {/* Debug panel */}
      {debug && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="font-semibold text-slate-900 mb-2">Debug</div>
          <pre className="max-h-[260px] overflow-auto">{JSON.stringify(debug, null, 2)}</pre>
        </div>
      )}

      {/* Payload preview */}
      {data && (
        <div className="max-h-[400px] overflow-auto rounded bg-slate-900 text-slate-100 p-3">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
