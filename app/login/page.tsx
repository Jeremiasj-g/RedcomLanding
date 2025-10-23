'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

type Branch = { name: string };

export default function LoginPage() {
  const router = useRouter();

  // login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // modal: solicitar acceso
  const [askOpen, setAskOpen] = useState(false);
  const [askEmail, setAskEmail] = useState('');
  const [askSending, setAskSending] = useState(false);
  const [askOk, setAskOk] = useState<string | null>(null);
  const [askErr, setAskErr] = useState<string | null>(null);

  // chips sucursales desde BD
  const [branches, setBranches] = useState<Branch[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoadingSession(false);
      if (data.session) router.replace('/app');
    });
  }, [router]);

  useEffect(() => {
    // cargar opciones de sucursales
    supabase
      .from('branches')
      .select('name')
      .order('name')
      .then(({ data }) => setBranches((data ?? []) as Branch[]));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setSubmitting(false);
      return setError(error.message);
    }

    // Validar activo
    const userId = signInData.user?.id;
    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .select('is_active, full_name')
      .eq('id', userId)
      .single();

    if (pErr) {
      await supabase.auth.signOut();
      setSubmitting(false);
      return setError('No se pudo validar tu cuenta. Intentá de nuevo.');
    }
    if (!prof?.is_active) {
      await supabase.auth.signOut();
      setSubmitting(false);
      return setError('Tu usuario está inactivo. Consultá con un administrador.');
    }

    router.replace('/app');
    router.refresh();
  };

  const togglePick = (name: string) => {
    setPicked(prev => (prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]));
  };

  const submitAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    setAskErr(null);
    setAskOk(null);

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(askEmail)) {
      setAskErr('Ingresá un correo válido.');
      return;
    }

    setAskSending(true);
    const { error } = await supabase.from('signup_requests').insert({
      email: askEmail.trim().toLowerCase(),
      status: 'pending',
      requested_branches: picked,
      comment: comment.trim() || null,
    });

    setAskSending(false);
    if (error) {
      setAskErr(error.message);
    } else {
      setAskOk('Solicitud enviada. Te contactaremos a la brevedad.');
      setAskEmail('');
      setPicked([]);
      setComment('');
      setTimeout(() => {
        setAskOk(null);
        setAskOpen(false);
      }, 2500);
    }
  };

  if (loadingSession) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl rounded-3xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Columna izquierda: Form */}
          <div className="p-8 md:p-12">
            <div className="mb-8 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-white font-semibold">R</div>
              <span className="text-lg font-semibold text-slate-900">REDCOM</span>
            </div>

            <h1 className="text-3xl font-bold text-slate-900">¡Bienvenido otra vez!</h1>
            <p className="mt-2 text-sm text-slate-500">Ingresá tu correo y contraseña para acceder a tu cuenta.</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Correo</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Contraseña</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                  Recordarme
                </label>
                <span className="text-slate-500">¿Olvidaste tu contraseña?</span>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                className="mt-2 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="mt-8 h-px w-full bg-slate-200" />

            <p className="mt-6 text-center text-sm text-slate-600">
              ¿No tenés una cuenta?{' '}
              <button
                className="font-semibold text-slate-900 hover:underline"
                onClick={() => setAskOpen(true)}
                type="button"
              >
                Solicitar acceso
              </button>
            </p>
          </div>

          {/* Columna derecha: Ilustración / CTA */}
          <div className="relative hidden md:block">
            <div className="absolute inset-0 bg-red-400" />
            <div className="relative h-full w-full p-10 text-red-50">
              <h2 className="text-2xl font-bold leading-tight">Gestioná tu equipo y operaciones sin esfuerzo.</h2>
              <p className="mt-2 text-red-100/90">Accedé a tu panel para monitorear tus sucursales y procesos.</p>
              <div className="mt-8 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-24 rounded-xl bg-white/20" />
                  <div className="h-24 rounded-xl bg-white/20" />
                  <div className="h-24 rounded-xl bg-white/20" />
                  <div className="col-span-3 h-32 rounded-xl bg-white/20" />
                </div>
              </div>
              {/* <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90rem_60rem_at_top,rgba(255,255,255,0.25),transparent)]" /> */}
              <div className="absolute bottom-0 right-0 h-[45%] w-[45%] border rounded-full bg-gray-50 blur-[120px]" />
              <div className="absolute top-0 left-0 h-[25%] w-[25%] border rounded-full bg-gray-50 blur-[120px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Solicitar Acceso */}
      {askOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !askSending && setAskOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Solicitar acceso</h3>
            <p className="mt-1 text-sm text-slate-600">
              Ingresá tu correo, elegí tus sucursales y añadí un comentario si lo necesitás.
            </p>

            <form onSubmit={submitAsk} className="mt-4 space-y-4">
              <input
                type="email"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="tu@empresa.com"
                value={askEmail}
                onChange={(e) => setAskEmail(e.target.value)}
                required
              />

              <div>
                <div className="mb-2 text-xs text-slate-600">Sucursales</div>
                <div className="flex flex-wrap gap-2">
                  {branches.map(b => {
                    const active = picked.includes(b.name);
                    return (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() => togglePick(b.name)}
                        className={`rounded-full border px-3 py-1 text-sm capitalize ${
                          active ? 'bg-emerald-100 border-emerald-300' : 'hover:bg-slate-50'
                        }`}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Comentario (opcional)</label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  rows={3}
                  placeholder="Contanos a qué sucursal pertenecés."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>

              {askErr && <p className="text-sm text-red-600">{askErr}</p>}
              {askOk && <p className="text-sm text-emerald-700">{askOk}</p>}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                  onClick={() => setAskOpen(false)}
                  disabled={askSending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  disabled={askSending}
                >
                  {askSending ? 'Enviando…' : 'Solicitar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}