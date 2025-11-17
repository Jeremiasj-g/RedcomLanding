'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [linkStatus, setLinkStatus] =
    useState<'checking' | 'ok' | 'invalid'>('checking');

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // 1) Leer token desde el hash y crear sesión temporal
  useEffect(() => {
    (async () => {
      try {
        if (typeof window === 'undefined') return;

        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;

        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const type = params.get('type');

        if (!access_token || !refresh_token || type !== 'recovery') {
          setLinkStatus('invalid');
          setError(
            'El enlace de recuperación no es válido, ya fue usado o expiró. Pedí uno nuevo desde el inicio de sesión.'
          );
          return;
        }

        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error || !data.session) {
          setLinkStatus('invalid');
          setError(
            'El enlace de recuperación no es válido, ya fue usado o expiró. Pedí uno nuevo desde el inicio de sesión.'
          );
          return;
        }

        setLinkStatus('ok');
      } catch {
        setLinkStatus('invalid');
        setError(
          'El enlace de recuperación no es válido, ya fue usado o expiró. Pedí uno nuevo desde el inicio de sesión.'
        );
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    if (pass1.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (pass1 !== pass2) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({
      password: pass1,
    });

    setSubmitting(false);

    if (error) {
      setError(error.message || 'No se pudo actualizar la contraseña.');
      return;
    }

    setOkMsg('Tu contraseña fue actualizada correctamente.');
    setPass1('');
    setPass2('');

    setTimeout(() => {
      router.replace('/login');
    }, 2500);
  };

  if (linkStatus === 'checking') {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl ring-1 ring-black/5 p-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Restablecer contraseña
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Ingresá tu nueva contraseña para continuar.
        </p>

        {linkStatus === 'invalid' && (
          <p className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {linkStatus === 'ok' && (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {/* Campo 1 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Nueva contraseña
              </label>

              <div className="relative">
                <input
                  type={show1 ? 'text' : 'password'}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Mínimo 8 caracteres"
                  value={pass1}
                  onChange={(e) => setPass1(e.target.value)}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShow1(!show1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
                >
                  {show1 ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Campo 2 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Repetir contraseña
              </label>

              <div className="relative">
                <input
                  type={show2 ? 'text' : 'password'}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="Repetí la contraseña"
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShow2(!show2)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition"
                >
                  {show2 ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {okMsg && <p className="text-sm text-emerald-700">{okMsg}</p>}

            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Guardando…' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
