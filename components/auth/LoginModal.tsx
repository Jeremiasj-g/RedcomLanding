'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';

type Branch = { name: string };

export default function LoginModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forgotSending, setForgotSending] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotErr, setForgotErr] = useState<string | null>(null);

  const [askOpen, setAskOpen] = useState(false);
  const [askEmail, setAskEmail] = useState('');
  const [askSending, setAskSending] = useState(false);
  const [askOk, setAskOk] = useState<string | null>(null);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !askSending) {
        if (askOpen) setAskOpen(false);
        else onOpenChange(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [askOpen, askSending, onOpenChange, open]);

  useEffect(() => {
    if (!open || branches.length) return;

    supabase
      .from('branches')
      .select('name')
      .order('name')
      .then(({ data }) => setBranches((data ?? []) as Branch[]));
  }, [branches.length, open]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setForgotErr(null);
    setForgotMsg(null);
    setSubmitting(true);

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }

    const userId = signInData.user?.id;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', userId)
      .single();

    if (profileError) {
      await supabase.auth.signOut();
      setSubmitting(false);
      setError('No se pudo validar tu cuenta. Intentá de nuevo.');
      return;
    }

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      setSubmitting(false);
      setError('Tu usuario está inactivo. Consultá con un administrador.');
      return;
    }

    onOpenChange(false);
    router.replace('/app');
    router.refresh();
  };

  const handleForgotPassword = async () => {
    setForgotErr(null);
    setForgotMsg(null);

    if (!email.trim()) {
      setForgotErr('Ingresá tu correo primero.');
      return;
    }

    setForgotSending(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` },
    );

    setForgotSending(false);

    if (resetError) {
      setForgotErr(resetError.message);
      return;
    }

    setForgotMsg(
      'Si el correo existe en el sistema, te enviamos un enlace para restablecer tu contraseña.',
    );
  };

  const togglePick = (name: string) => {
    setPicked((current) =>
      current.includes(name)
        ? current.filter((branch) => branch !== name)
        : [...current, name],
    );
  };

  const submitAsk = async (event: React.FormEvent) => {
    event.preventDefault();
    setAskErr(null);
    setAskOk(null);

    if (!/\S+@\S+\.\S+/.test(askEmail)) {
      setAskErr('Ingresá un correo válido.');
      return;
    }

    setAskSending(true);
    const { error: requestError } = await supabase
      .from('signup_requests')
      .insert({
        email: askEmail.trim().toLowerCase(),
        status: 'pending',
        requested_branches: picked,
        comment: comment.trim() || null,
      });

    setAskSending(false);

    if (requestError) {
      setAskErr(requestError.message);
      return;
    }

    setAskOk('Solicitud enviada. Te contactaremos a la brevedad.');
    setAskEmail('');
    setPicked([]);
    setComment('');

    window.setTimeout(() => {
      setAskOk(null);
      setAskOpen(false);
    }, 2200);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Cerrar acceso"
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-[#0b0b0d]/55 backdrop-blur-xl"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Iniciar sesión"
            initial={{ opacity: 0, y: 22, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.985 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-[980px] overflow-hidden rounded-[30px] border border-white/60 bg-white/95 shadow-[0_40px_120px_rgba(0,0,0,.30)] backdrop-blur-2xl"
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/20 text-white/80 backdrop-blur-xl transition hover:bg-black/35 hover:text-white md:right-5 md:top-5"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid min-h-[610px] md:grid-cols-[0.96fr_1.04fr]">
              <div className="flex flex-col bg-[#fbfbfc] px-6 py-7 sm:px-9 sm:py-9 md:px-11 md:py-10">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/LogoRedcom.png"
                    alt="Redcom"
                    className="h-9 w-9 object-contain"
                  />
                  <div>
                    <div className="text-[14px] font-semibold tracking-[0.04em] text-[#17181b]">
                      REDCOM
                    </div>
                    <div className="text-[8px] font-medium uppercase tracking-[0.16em] text-slate-400">
                      Workspace
                    </div>
                  </div>
                </div>

                <div className="mt-10">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                    Acceso al sistema
                  </div>
                  <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.045em] text-[#17181b] sm:text-[34px]">
                    Bienvenido otra vez.
                  </h2>
                  <p className="mt-2 max-w-sm text-[13px] leading-5 text-slate-500">
                    Ingresá con tus credenciales para continuar a tu espacio de trabajo.
                  </p>
                </div>

                <form onSubmit={onSubmit} className="mt-8 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Correo
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="tu@empresa.com"
                        autoComplete="email"
                        required
                        autoFocus
                        className="h-12 w-full rounded-[14px] border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Contraseña
                    </label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        className="h-12 w-full rounded-[14px] border border-slate-200 bg-white pl-10 pr-11 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                        aria-label={
                          showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <label className="flex items-center gap-2 text-slate-500">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-[#17181b]"
                      />
                      Recordarme
                    </label>

                    <button
                      type="button"
                      onClick={() => void handleForgotPassword()}
                      disabled={forgotSending}
                      className="font-medium text-slate-500 transition hover:text-slate-950 disabled:opacity-50"
                    >
                      {forgotSending
                        ? 'Enviando...'
                        : '¿Olvidaste tu contraseña?'}
                    </button>
                  </div>

                  {error || forgotErr || forgotMsg ? (
                    <div
                      className={`rounded-[12px] border px-3.5 py-3 text-[11px] leading-5 ${
                        forgotMsg
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                    >
                      {error || forgotErr || forgotMsg}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="group mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#17181b] px-5 text-[12px] font-semibold text-white transition hover:bg-[#242529] disabled:cursor-wait disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Iniciar sesión
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-auto border-t border-slate-200 pt-5 text-center text-[11px] text-slate-500">
                  ¿No tenés una cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => setAskOpen(true)}
                    className="font-semibold text-slate-900 transition hover:text-black"
                  >
                    Solicitar acceso
                  </button>
                </div>
              </div>

              <div className="relative hidden min-h-[610px] overflow-hidden bg-[#17181b] md:block">
                <img
                  src="/avatar-login.webp"
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-black/10" />
                <div className="absolute inset-x-0 bottom-0 p-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[10px] font-medium text-white/80 backdrop-blur-xl">
                    <Check className="h-3.5 w-3.5" />
                    Acceso seguro · Redcom
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {askOpen ? (
              <motion.div
                className="absolute inset-0 z-30 grid place-items-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-black/35 backdrop-blur-md"
                  onClick={() => !askSending && setAskOpen(false)}
                  aria-label="Cerrar solicitud"
                />

                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.985 }}
                  className="relative z-10 w-full max-w-[480px] rounded-[24px] border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,.24)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-slate-400">
                        Nuevo usuario
                      </div>
                      <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">
                        Solicitar acceso
                      </h3>
                      <p className="mt-1 text-[12px] leading-5 text-slate-500">
                        Indicá tu correo y las sucursales que necesitás utilizar.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAskOpen(false)}
                      disabled={askSending}
                      className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={submitAsk} className="mt-5 space-y-4">
                    <input
                      type="email"
                      value={askEmail}
                      onChange={(event) => setAskEmail(event.target.value)}
                      placeholder="tu@empresa.com"
                      required
                      className="h-11 w-full rounded-[12px] border border-slate-200 px-3.5 text-[12px] text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    />

                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        Sucursales
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {branches.map((branch) => {
                          const active = picked.includes(branch.name);
                          return (
                            <button
                              key={branch.name}
                              type="button"
                              onClick={() => togglePick(branch.name)}
                              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                                active
                                  ? 'border-slate-950 bg-slate-950 text-white'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {branch.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Comentario opcional"
                      className="w-full resize-none rounded-[12px] border border-slate-200 px-3.5 py-3 text-[12px] text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    />

                    {askErr || askOk ? (
                      <div
                        className={`rounded-[12px] border px-3 py-2.5 text-[11px] ${
                          askOk
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}
                      >
                        {askErr || askOk}
                      </div>
                    ) : null}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={askSending}
                        onClick={() => setAskOpen(false)}
                        className="h-10 rounded-[11px] px-4 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={askSending}
                        className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-slate-950 px-4 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {askSending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Solicitar acceso
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
