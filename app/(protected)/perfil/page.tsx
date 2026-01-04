'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';
import { Check, AlertCircle, Eye, EyeOff, Copy, BadgeCheck, ShieldCheck, Building2 } from 'lucide-react';
import DualSpinner from '@/components/ui/DualSpinner';

type Toast = { type: 'ok' | 'err'; text: string } | null;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function cap(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function roleLabel(role?: string) {
  const r = (role ?? '').toLowerCase();
  if (!r) return 'Sin rol';
  if (r === 'jdv') return 'Jefe de Ventas';
  if (r === 'rrhh') return 'RRHH';
  if (r === 'admin') return 'Administrador';
  if (r === 'supervisor') return 'Supervisor';
  if (r === 'vendedor') return 'Vendedor';
  return role ?? 'Rol';
}

// ✅ Accesible (modo claro)
function rolePillClassLight(role?: string) {
  const r = (role ?? '').toLowerCase();
  if (r === 'admin') return 'border-amber-300 bg-amber-50 text-amber-900';
  if (r === 'jdv') return 'border-violet-300 bg-violet-50 text-violet-900';
  if (r === 'rrhh') return 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900';
  if (r === 'supervisor') return 'border-sky-300 bg-sky-50 text-sky-900';
  return 'border-slate-300 bg-slate-50 text-slate-900';
}

export default function MiPerfilPage() {
  const { me, loading } = useMe();

  // Nombre
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Password
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  // Toast
  const [msg, setMsg] = useState<Toast>(null);
  const show = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    window.setTimeout(() => setMsg(null), 3500);
  };

  useEffect(() => {
    if (me?.full_name) setFullName(me.full_name);
  }, [me?.full_name]);

  const initials = useMemo(() => {
    const name = (me?.full_name ?? '').trim();
    if (!name) return (me?.email ?? 'U')[0]?.toUpperCase?.() ?? 'U';
    const p = name.split(' ').filter(Boolean);
    return (p[0][0] + (p[1]?.[0] ?? '')).toUpperCase();
  }, [me?.full_name, me?.email]);

  const branches = useMemo(
    () => (me?.branches ?? []).map((b) => String(b).toLowerCase()),
    [me?.branches],
  );

  // Guardar nombre
  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return show('err', 'El nombre no puede estar vacío.');

    setSavingName(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;

    if (!userId) {
      setSavingName(false);
      return show('err', 'Sesión no encontrada.');
    }

    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', userId);

    setSavingName(false);
    if (error) return show('err', error.message);
    show('ok', 'Nombre actualizado.');
  };

  // Cambiar contraseña
  const savePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return show('err', 'La contraseña debe tener al menos 8 caracteres.');
    if (pwd !== pwd2) return show('err', 'Las contraseñas no coinciden.');

    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);

    if (error) return show('err', error.message);

    setPwd('');
    setPwd2('');
    setShowPwd(false);
    setShowPwd2(false);
    show('ok', 'Contraseña actualizada.');
  };

  const copyEmail = async () => {
    try {
      if (!me?.email) return;
      await navigator.clipboard.writeText(me.email);
      show('ok', 'Email copiado.');
    } catch {
      show('err', 'No se pudo copiar el email.');
    }
  };

  if (!me) {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <DualSpinner size={60} thickness={4} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Toast */}
      {msg && (
        <div
          className={cn(
            'fixed right-4 top-4 z-50 flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
            msg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800',
          )}
        >
          {msg.type === 'ok' ? <Check className="mt-0.5 h-5 w-5" /> : <AlertCircle className="mt-0.5 h-5 w-5" />}
          <span className="text-sm">{msg.text}</span>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* CARD PRINCIPAL (clara) */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {/* ✅ SOLO ESTE HEADER OSCURO */}
          <div className="relative h-44 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
            <div className="absolute inset-0 opacity-70 [background:radial-gradient(ellipse_at_top,rgba(56,189,248,0.20),transparent_60%)]" />
            <div className="absolute inset-0 opacity-60 [background:radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.16),transparent_60%)]" />
          </div>

          <div className="relative px-5 pb-6 mt-16">
            {/* Avatar + nombre (sin recorte) */}
            <div className="-mt-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex items-end gap-4">
                <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-slate-800 text-xl font-bold text-white shadow-lg">
                  {initials}
                </div>

                <div className="pb-1">
                  <h1 className="text-xl font-semibold text-slate-900">{me.full_name || 'Sin nombre'}</h1>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="truncate">{me.email}</span>
                    <button
                      type="button"
                      onClick={copyEmail}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', rolePillClassLight(me.role))}
                    >
                      <BadgeCheck className="h-4 w-4" />
                      {roleLabel(me.role)}
                    </span>

                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                        me.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800',
                      )}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {me.is_active ? 'Activo' : 'Inactivo'}
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      <Building2 className="h-4 w-4" />
                      {branches.length ? `${branches.length} sucursal(es)` : 'Sin sucursal'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contenido claro */}
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Sucursales */}
              <aside className="md:col-span-1">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900">Sucursales</h2>
                    <span className="text-xs text-slate-500">Asignadas</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {branches.length === 0 ? (
                      <span className="text-sm text-slate-500">Sin asignación</span>
                    ) : (
                      branches.map((b) => (
                        <span
                          key={b}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold capitalize text-slate-700"
                        >
                          {cap(b)}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Si necesitás acceso a otra sucursal, pedíselo a un admin.
                  </div>
                </div>
              </aside>

              {/* Forms apilados */}
              <section className="md:col-span-2">
                <div className="space-y-6">
                  {/* Editar perfil */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <h2 className="text-base font-semibold text-slate-900">Editar perfil</h2>
                      <p className="mt-1 text-sm text-slate-600">Actualizá tu información básica.</p>
                    </div>

                    <form onSubmit={saveName} className="space-y-3">
                      <label className="text-xs font-semibold text-slate-700">Nombre completo</label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          className="w-full flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                          placeholder="Ej: Juan Pérez"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                        <button
                          type="submit"
                          disabled={savingName}
                          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingName ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Seguridad */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <h2 className="text-base font-semibold text-slate-900">Seguridad</h2>
                      <p className="mt-1 text-sm text-slate-600">Cambiá tu contraseña (mínimo 8 caracteres).</p>
                    </div>

                    <form onSubmit={savePwd} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-700">Nueva contraseña</label>
                        <div className="relative">
                          <input
                            type={showPwd ? 'text' : 'password'}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                            placeholder="Mínimo 8 caracteres"
                            value={pwd}
                            onChange={(e) => setPwd(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                            aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          >
                            {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-700">Repetir contraseña</label>
                        <div className="relative">
                          <input
                            type={showPwd2 ? 'text' : 'password'}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                            value={pwd2}
                            onChange={(e) => setPwd2(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd2((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                            aria-label={showPwd2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          >
                            {showPwd2 ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingPwd}
                          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingPwd ? 'Guardando...' : 'Cambiar contraseña'}
                        </button>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Recomendación: usá una contraseña única y evitá repetirla en otros sitios.
                      </div>
                    </form>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
