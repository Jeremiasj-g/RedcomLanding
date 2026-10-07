'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';
import DualSpinner from '@/components/ui/DualSpinner';
import { notify } from '@/lib/notifications';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function cap(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function roleLabel(role?: string) {
  const normalized = (role ?? '').toLowerCase();
  if (!normalized) return 'Sin rol';
  if (normalized === 'jdv') return 'Jefe de Ventas';
  if (normalized === 'rrhh') return 'RRHH';
  if (normalized === 'admin') return 'Administrador';
  if (normalized === 'supervisor') return 'Supervisor';
  if (normalized === 'vendedor') return 'Vendedor';
  return role ?? 'Rol';
}

function roleTone(role?: string) {
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'admin') {
    return 'border-amber-300/20 bg-amber-300/10 text-amber-200';
  }
  if (normalized === 'jdv') {
    return 'border-violet-300/20 bg-violet-300/10 text-violet-200';
  }
  if (normalized === 'rrhh') {
    return 'border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-200';
  }
  if (normalized === 'supervisor') {
    return 'border-sky-300/20 bg-sky-300/10 text-sky-200';
  }
  return 'border-white/[0.10] bg-white/[0.06] text-white/[0.72]';
}

export default function MiPerfilPage() {
  const { me } = useMe();

  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  useEffect(() => {
    if (me?.full_name) setFullName(me.full_name);
  }, [me?.full_name]);

  const initials = useMemo(() => {
    const name = (me?.full_name ?? '').trim();
    if (!name) return (me?.email ?? 'U')[0]?.toUpperCase?.() ?? 'U';

    const parts = name.split(' ').filter(Boolean);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }, [me?.email, me?.full_name]);

  const branches = useMemo(
    () => (me?.branches ?? []).map((branch) => String(branch).toLowerCase()),
    [me?.branches],
  );

  const nameDirty =
    fullName.trim() !== String(me?.full_name ?? '').trim() && fullName.trim().length > 0;

  const passwordReady = pwd.length >= 8 && pwd === pwd2;

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) {
      notify.warning('El nombre no puede estar vacío.');
      return;
    }

    setSavingName(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;

    if (!userId) {
      setSavingName(false);
      notify.error('Sesión no encontrada.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', userId);

    setSavingName(false);

    if (error) {
      notify.error(error.message);
      return;
    }

    notify.success('Nombre actualizado.');
  };

  const savePwd = async (event: React.FormEvent) => {
    event.preventDefault();

    if (pwd.length < 8) {
      notify.warning('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (pwd !== pwd2) {
      notify.warning('Las contraseñas no coinciden.');
      return;
    }

    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);

    if (error) {
      notify.error(error.message);
      return;
    }

    setPwd('');
    setPwd2('');
    setShowPwd(false);
    setShowPwd2(false);
    notify.success('Contraseña actualizada.');
  };

  const copyEmail = async () => {
    try {
      if (!me?.email) return;
      await navigator.clipboard.writeText(me.email);
      notify.success('Email copiado.');
    } catch {
      notify.error('No se pudo copiar el email.');
    }
  };

  if (!me) {
    return (
      <div className="grid min-h-[80vh] place-items-center bg-[#F4F5F7]">
        <DualSpinner size={60} thickness={4} />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#F4F5F7]">
      <div className="mx-auto max-w-[1380px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <section className="relative overflow-hidden rounded-[30px] border border-black/[0.06] bg-[#17181b] text-white shadow-[0_24px_70px_rgba(15,23,42,.14)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(90,200,250,.12),transparent_34%),radial-gradient(circle_at_88%_0%,rgba(167,139,250,.10),transparent_30%)]" />
          <div className="relative flex flex-col gap-8 px-6 py-7 sm:px-8 sm:py-8 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-10">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-[28px] border border-white/[0.09] bg-white/[0.07] text-3xl font-semibold tracking-[-0.04em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
                {initials}
                <span
                  className={cn(
                    'absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[4px] border-[#17181b]',
                    me.is_active ? 'bg-emerald-400' : 'bg-rose-400',
                  )}
                />
              </div>

              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/[0.30]">
                  Cuenta personal
                </div>
                <h1 className="mt-1.5 truncate text-[28px] font-medium tracking-[-0.035em] text-white/[0.96] sm:text-[34px]">
                  {me.full_name || 'Sin nombre'}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-white/[0.46]">
                    <Mail className="h-3.5 w-3.5" />
                    {me.email}
                  </span>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="inline-flex h-7 items-center gap-1.5 rounded-[9px] border border-white/[0.08] bg-white/[0.04] px-2.5 text-[10px] font-medium text-white/[0.52] transition hover:bg-white/[0.08] hover:text-white/[0.80]"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium',
                      roleTone(me.role),
                    )}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {roleLabel(me.role)}
                  </span>

                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium',
                      me.is_active
                        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
                        : 'border-rose-300/20 bg-rose-300/10 text-rose-200',
                    )}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {me.is_active ? 'Cuenta activa' : 'Cuenta inactiva'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[360px]">
              <HeroStat
                label="Sucursales"
                value={branches.length ? String(branches.length) : '0'}
              />
              <HeroStat label="Rol" value={roleLabel(me.role)} />
              <HeroStat
                label="Estado"
                value={me.is_active ? 'Activo' : 'Inactivo'}
                className="col-span-2 sm:col-span-1"
              />
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="space-y-5">
            <CardShell>
              <CardHeader
                icon={<UserRound className="h-4 w-4" />}
                eyebrow="Identidad"
                title="Información personal"
                description="El nombre que se muestra en asignaciones, comentarios y actividad."
              />

              <form onSubmit={saveName} className="mt-5">
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-slate-400">
                  Nombre completo
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="h-11 min-w-0 flex-1 rounded-[13px] border border-slate-200 bg-[#F8F9FA] px-3.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
                  />
                  <button
                    type="submit"
                    disabled={savingName || !nameDirty}
                    className="inline-flex h-11 min-w-[130px] items-center justify-center gap-2 rounded-[13px] bg-[#17181b] px-4 text-[11px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingName ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>

                <div className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-slate-400">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  El cambio se refleja en el resto de los módulos donde aparezca tu nombre.
                </div>
              </form>
            </CardShell>

            <CardShell>
              <CardHeader
                icon={<Building2 className="h-4 w-4" />}
                eyebrow="Alcance"
                title="Sucursales asignadas"
                description="Estos accesos son administrados centralmente y no se modifican desde el perfil."
              />

              <div className="mt-5">
                {branches.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-slate-200 bg-[#F8F9FA] px-4 py-6 text-center text-[11px] text-slate-400">
                    No tenés sucursales asignadas.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {branches.map((branch) => (
                      <div
                        key={branch}
                        className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-[#F8F9FA] px-3.5 py-3"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-slate-200 bg-white text-slate-500">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-[12px] font-medium text-slate-800">
                            {cap(branch)}
                          </div>
                          <div className="mt-0.5 text-[9px] text-slate-400">
                            Acceso asignado
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 rounded-[13px] border border-sky-100 bg-sky-50/60 px-3.5 py-3 text-[10px] leading-4 text-sky-800/70">
                  Si necesitás acceso a otra sucursal, solicitá el cambio a un administrador.
                </div>
              </div>
            </CardShell>
          </section>

          <section className="space-y-5">
            <CardShell>
              <CardHeader
                icon={<LockKeyhole className="h-4 w-4" />}
                eyebrow="Seguridad"
                title="Contraseña"
                description="Actualizá tu contraseña sin salir de tu cuenta."
              />

              <form onSubmit={savePwd} className="mt-5 space-y-4">
                <PasswordField
                  label="Nueva contraseña"
                  value={pwd}
                  onChange={setPwd}
                  visible={showPwd}
                  onToggle={() => setShowPwd((value) => !value)}
                  placeholder="Mínimo 8 caracteres"
                />

                <PasswordField
                  label="Confirmar contraseña"
                  value={pwd2}
                  onChange={setPwd2}
                  visible={showPwd2}
                  onToggle={() => setShowPwd2((value) => !value)}
                  placeholder="Repetí la contraseña"
                />

                <div className="grid gap-2 sm:grid-cols-3">
                  <SecurityCheck
                    label="8+ caracteres"
                    active={pwd.length >= 8}
                  />
                  <SecurityCheck
                    label="Coinciden"
                    active={pwd.length > 0 && pwd === pwd2}
                  />
                  <SecurityCheck
                    label="Lista para guardar"
                    active={passwordReady}
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex max-w-md items-start gap-2 text-[10px] leading-4 text-slate-400">
                    <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Usá una contraseña única que no reutilices en otros servicios.
                  </div>

                  <button
                    type="submit"
                    disabled={savingPwd || !passwordReady}
                    className="inline-flex h-11 min-w-[166px] items-center justify-center gap-2 rounded-[13px] bg-[#17181b] px-4 text-[11px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <LockKeyhole className="h-3.5 w-3.5" />
                    {savingPwd ? 'Actualizando...' : 'Cambiar contraseña'}
                  </button>
                </div>
              </form>
            </CardShell>

            <div className="grid gap-5 sm:grid-cols-2">
              <MiniCard
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Estado de cuenta"
                value={me.is_active ? 'Activa' : 'Inactiva'}
                detail={
                  me.is_active
                    ? 'Tu acceso se encuentra habilitado.'
                    : 'Tu acceso está restringido.'
                }
              />

              <MiniCard
                icon={<Sparkles className="h-4 w-4" />}
                title="Tipo de acceso"
                value={roleLabel(me.role)}
                detail="Determina permisos base y herramientas visibles."
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function HeroStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[16px] border border-white/[0.07] bg-white/[0.035] px-3.5 py-3',
        className,
      )}
    >
      <div className="text-[9px] font-medium uppercase tracking-[0.09em] text-white/[0.28]">
        {label}
      </div>
      <div className="mt-1 truncate text-[12px] font-medium text-white/[0.82]">
        {value}
      </div>
    </div>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,.045)] sm:p-6">
      {children}
    </section>
  );
}

function CardHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-slate-200 bg-[#F8F9FA] text-slate-500">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-medium uppercase tracking-[0.11em] text-slate-400">
          {eyebrow}
        </div>
        <h2 className="mt-0.5 text-[16px] font-medium tracking-[-0.015em] text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-slate-400">
        {label}
      </span>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-[13px] border border-slate-200 bg-[#F8F9FA] px-3.5 pr-11 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/60"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[9px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </label>
  );
}

function SecurityCheck({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[11px] border px-3 py-2 text-[9px] font-medium transition',
        active
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-[#F8F9FA] text-slate-400',
      )}
    >
      <span
        className={cn(
          'grid h-4 w-4 place-items-center rounded-full',
          active ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400',
        )}
      >
        <Check className="h-2.5 w-2.5" />
      </span>
      {label}
    </div>
  );
}

function MiniCard({
  icon,
  title,
  value,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,.04)]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border border-slate-200 bg-[#F8F9FA] text-slate-500">
          {icon}
        </div>
        <div>
          <div className="text-[10px] font-medium text-slate-400">{title}</div>
          <div className="mt-1 text-[13px] font-medium text-slate-900">{value}</div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p>
        </div>
      </div>
    </section>
  );
}
