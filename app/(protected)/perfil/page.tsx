'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';
import { Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

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

  // Mensajes
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const show = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
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
    () => (me?.branches ?? []).map((b) => b.toLowerCase()),
    [me?.branches]
  );

  // Guardar nombre
  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      show('err', 'El nombre no puede estar vacío.');
      return;
    }
    setSavingName(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setSavingName(false);
      show('err', 'Sesión no encontrada.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', userId);

    setSavingName(false);
    if (error) {
      show('err', error.message);
      return;
    }
    show('ok', 'Nombre actualizado.');
  };

  // Cambiar contraseña
  const savePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) {
      show('err', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (pwd !== pwd2) {
      show('err', 'Las contraseñas no coinciden.');
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) {
      show('err', error.message);
      return;
    }
    setPwd('');
    setPwd2('');
    show('ok', 'Contraseña actualizada.');
  };

  if (loading || !me) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Toast */}
      {msg && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
            msg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {msg.type === 'ok' ? (
            <Check className="mt-0.5 h-5 w-5" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5" />
          )}
          <span className="text-sm">{msg.text}</span>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 md:grid-cols-3">
        {/* Panel izquierdo: avatar e info */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-700 text-2xl font-bold text-slate-100 shadow-md">
              {initials}
            </div>

            <h1 className="mt-4 text-xl font-semibold text-slate-900">
              {me.full_name || 'Sin nombre'}
            </h1>
            <p className="text-sm text-slate-500">{me.email}</p>

            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Rol</p>
                <p className="mt-1 font-medium capitalize text-slate-900">{me.role}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Estado
                </p>
                <p
                  className={`mt-1 font-medium ${
                    me.is_active ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {me.is_active ? 'Activo' : 'Inactivo'}
                </p>
              </div>
            </div>

            <div className="mt-5 w-full rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                Sucursales
              </p>
              <div className="flex flex-wrap gap-2">
                {branches.length === 0 && (
                  <span className="text-sm text-slate-400">Sin asignación</span>
                )}
                {branches.map((b) => (
                  <span
                    key={b}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium capitalize text-slate-700"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Panel derecho: edición */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Editar perfil</h2>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Form Nombre */}
            <form
              onSubmit={saveName}
              className="rounded-xl border border-slate-200 bg-slate-50 p-5"
            >
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Nombre completo
              </h3>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">Nombre</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
                  placeholder="Ej: Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={savingName}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingName ? 'Guardando...' : 'Guardar nombre'}
                </button>
              </div>
            </form>

            {/* Form Password */}
            <form
              onSubmit={savePwd}
              className="rounded-xl border border-slate-200 bg-slate-50 p-5"
            >
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Cambiar contraseña
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
                    placeholder="Mínimo 8 caracteres"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showPwd ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <label className="text-xs font-medium text-slate-600">
                  Repetir contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPwd2 ? 'text' : 'password'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
                    value={pwd2}
                    onChange={(e) => setPwd2(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd2((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showPwd2 ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPwd}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPwd ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
