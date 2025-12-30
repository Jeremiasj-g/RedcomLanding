'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useBranches } from '@/hooks/useBranches';

type AnnouncementType = 'news' | 'weekly' | 'birthday' | 'important_alert';
type Severity = 'info' | 'warning' | 'critical';

type Props = {
  initial?: any; // si querés editar luego
  onSaved?: () => void;
};

const ROLES = ['admin', 'supervisor', 'vendedor', 'rrhh'] as const;

export function AnnouncementEditor({ initial, onSaved }: Props) {
  const [type, setType] = useState<AnnouncementType>(initial?.type ?? 'news');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [severity, setSeverity] = useState<Severity>(initial?.severity ?? 'info');
  const [requireAck, setRequireAck] = useState<boolean>(initial?.require_ack ?? false);
  const [pinned, setPinned] = useState<boolean>(initial?.pinned ?? false);

  const [startsAt, setStartsAt] = useState<string>(
    initial?.starts_at ? initial.starts_at.slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [endsAt, setEndsAt] = useState<string>(initial?.ends_at ? initial.ends_at.slice(0, 16) : '');

  const [audAll, setAudAll] = useState<boolean>(initial?.audience?.all ?? true);
  const [audRoles, setAudRoles] = useState<string[]>(initial?.audience?.roles ?? []);
  const [audBranches, setAudBranches] = useState<string[]>(initial?.audience?.branches ?? []);

  const [isPublished, setIsPublished] = useState<boolean>(initial?.is_published ?? true);
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);


  const { branches, loading: branchesLoading } = useBranches();
  const [branchSearch, setBranchSearch] = useState('');

  const filteredBranches = useMemo(() => {
    const q = branchSearch.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        b.label.toLowerCase().includes(q) ||
        b.value.toLowerCase().includes(q)
    );
  }, [branches, branchSearch]);



  const audience = useMemo(() => {
    if (audAll) return { all: true };
    const out: any = { all: false };
    if (audRoles.length) out.roles = audRoles;
    if (audBranches.length) out.branches = audBranches;
    return out;
  }, [audAll, audRoles, audBranches]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        type,
        title,
        content,
        severity,
        require_ack: type === 'important_alert' ? requireAck : false,
        pinned,
        audience,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        is_published: isPublished,
        is_active: isActive,
      };

      if (initial?.id) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', initial.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('announcements').insert(payload);
        if (error) throw error;
      }

      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-extrabold text-slate-900">Crear / Editar novedad</div>
          <div className="text-sm text-slate-500">Configuración completa (empresa)</div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || !title.trim() || !content.trim()}
          className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-600">Tipo</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={type}
            onChange={(e) => setType(e.target.value as AnnouncementType)}
          >
            <option value="news">Noticia</option>
            <option value="weekly">Semanal</option>
            <option value="birthday">Cumpleaños</option>
            <option value="important_alert">Alerta importante (popup)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Severidad</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          {type === 'important_alert' ? (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={requireAck}
                onChange={(e) => setRequireAck(e.target.checked)}
              />
              Requiere “Entendido” (ACK obligatorio)
            </label>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-semibold text-slate-600">Título</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Aviso importante de fin de año…"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-xs font-semibold text-slate-600">Contenido</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[140px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Texto detallado…"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Empieza</label>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Termina (opcional)</label>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>

        <div className="lg:col-span-2 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Fijar arriba (pinned)
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            Publicado
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo
          </label>
        </div>
      </div>

      {/* Audience */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-extrabold text-slate-900">Audiencia</div>
            <div className="text-sm text-slate-600">A quién le aparece (RLS filtra)</div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" checked={audAll} onChange={(e) => setAudAll(e.target.checked)} />
            Todos
          </label>
        </div>

        {!audAll ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-600">Roles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLES.map((r) => {
                  const active = audRoles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setAudRoles((prev) =>
                          active ? prev.filter((x) => x !== r) : [...prev, r]
                        )
                      }
                      className={[
                        'px-3 py-1.5 rounded-xl text-xs font-bold border transition',
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
                      ].join(' ')}
                    >
                      {r.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600">Sucursales (branches)</div>

              {/* Chips seleccionados */}
              <div className="mt-2 flex flex-wrap gap-2">
                {audBranches.length === 0 ? (
                  <span className="text-xs text-slate-500">Sin filtro (todas)</span>
                ) : (
                  audBranches.map((v) => {
                    const found = branches.find((b) => b.value === v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAudBranches((prev) => prev.filter((x) => x !== v))}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        title="Quitar"
                      >
                        {found?.label ?? v}
                        <span className="text-slate-400">×</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Selector */}
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder={branchesLoading ? 'Cargando sucursales…' : 'Buscar sucursal…'}
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    disabled={branchesLoading}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      // toggle all visibles
                      const visible = filteredBranches.map((b) => b.value);
                      const allSelected = visible.every((v) => audBranches.includes(v));
                      setAudBranches((prev) =>
                        allSelected
                          ? prev.filter((v) => !visible.includes(v))
                          : Array.from(new Set([...prev, ...visible]))
                      );
                    }}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"
                    title="Seleccionar / deseleccionar visibles"
                  >
                    <ChevronsUpDown className="h-4 w-4" />
                    {filteredBranches.length}
                  </button>
                </div>

                <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-slate-100">
                  {filteredBranches.length === 0 ? (
                    <div className="p-3 text-sm text-slate-600">No hay resultados.</div>
                  ) : (
                    filteredBranches.map((b) => {
                      const selected = audBranches.includes(b.value);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            setAudBranches((prev) =>
                              selected ? prev.filter((x) => x !== b.value) : [...prev, b.value]
                            )
                          }
                          className={[
                            'w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-50',
                            selected ? 'bg-slate-50' : '',
                          ].join(' ')}
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{b.label}</div>
                            <div className="text-xs text-slate-500">{b.value}</div>
                          </div>
                          {selected ? (
                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-xl bg-slate-900 text-white">
                              <Check className="h-4 w-4" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-xl border border-slate-200 text-slate-400">
                              <Check className="h-4 w-4 opacity-0" />
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  Se guardan como <b>slugs</b> (lowercase) y matchea contra <b>user_branches</b>.
                  Dejá vacío para “todas”.
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
