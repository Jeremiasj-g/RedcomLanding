'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
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
  UserRound,
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';
import { notify } from '@/lib/notifications';
import { isMyCommercialVendorAccount } from '@/lib/commercialVendorAccess';
import CommercialProfileCategories from '@/components/profile/CommercialProfileCategories';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';

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

export default function MiPerfilPage() {
  const { me, refetch } = useMe();

  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [commercialVendor, setCommercialVendor] = useState(false);
  const [vendorStatusLoading,setVendorStatusLoading]=useState(true);
  const [activeTab,setActiveTab]=useState<'profile'|'category'>('profile');
  const [visitedCategory,setVisitedCategory]=useState(false);
  const [pendingTab,setPendingTab]=useState<'profile'|'category'|null>(null);

  const [currentPwd,setCurrentPwd]=useState('');
  const [showCurrentPwd,setShowCurrentPwd]=useState(false);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  useEffect(() => {
    if (me?.full_name) setFullName(me.full_name);
  }, [me?.full_name]);

  useEffect(() => {
    if (!me?.id) return;
    let active = true;
    setVendorStatusLoading(true);
    void isMyCommercialVendorAccount().then(value => {
      if (active){setCommercialVendor(value);setVendorStatusLoading(false);}
    }).catch(() => {
      // Conservador ante errores: un vendedor no debe poder editar su
      // nombre hasta resolver la consulta de identidad comercial.
      if (active){if(me.role === 'vendedor')setCommercialVendor(true);setVendorStatusLoading(false);}
    });
    return () => { active = false; };
  }, [me?.id, me?.role]);

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

  const isTechnicalEmail=/^vendor-[0-9a-f-]+@example\.com$/i.test(me?.email??'');
  const displayEmail=Boolean(me?.email)&&!commercialVendor&&!isTechnicalEmail;
  const lockCommercialName=commercialVendor||(me?.role==='vendedor'&&vendorStatusLoading);

  const nameDirty =
    fullName.trim() !== String(me?.full_name ?? '').trim() && fullName.trim().length > 0;

  const passwordReady = currentPwd.length>0 && pwd.length >= 8 && pwd === pwd2;
  const hasPendingEdits=Boolean(currentPwd||pwd||pwd2||(!lockCommercialName&&nameDirty));
  useEffect(()=>{
    if(!hasPendingEdits)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[hasPendingEdits]);

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if(savingName)return;
    if (lockCommercialName) {
      notify.warning('Tu nombre se administra desde DetallePersonal.');
      return;
    }
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

    await refetch();
    notify.success('Nombre actualizado.');
  };

  const savePwd = async (event: React.FormEvent) => {
    event.preventDefault();
    if(savingPwd)return;

    if (!currentPwd) {
      notify.warning('Ingresá la contraseña actual.');
      return;
    }
    if (pwd.length < 8) {
      notify.warning('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (pwd !== pwd2) {
      notify.warning('Las contraseñas no coinciden.');
      return;
    }

    setSavingPwd(true);
    try {
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError||!user?.id||!user.email)throw new Error('No se pudo verificar la sesión.');
      // Validación real contra Supabase Auth; nunca guardar ni registrar la clave actual.
      const {data:verified,error:verifyError}=await supabase.auth.signInWithPassword({
        email:user.email,password:currentPwd,
      });
      if(verifyError||verified.user?.id!==user.id){
        notify.error('La contraseña actual no es correcta.');
        return;
      }
      const {error:updateError}=await supabase.auth.updateUser({password:pwd});
      if(updateError)throw updateError;
    }catch(error){
      notify.error(error instanceof Error?error.message:'No se pudo cambiar la contraseña.');
      return;
    }finally{
      setSavingPwd(false);
    }
    setCurrentPwd('');
    setShowCurrentPwd(false);
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
        <div className="w-full max-w-3xl space-y-6 px-5" role="status" aria-label="Cargando perfil">
  <div className="flex items-center gap-5"><div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none"/><div className="flex-1 space-y-3"><div className="h-7 w-44 max-w-full animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none"/><div className="h-4 w-28 animate-pulse rounded bg-slate-200 motion-reduce:animate-none"/></div></div>
  <div className="h-10 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none"/>
  <div className="grid gap-5 md:grid-cols-2"><div className="h-60 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none"/><div className="h-60 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none"/></div>
 </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#F4F5F7]">
      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {commercialVendor&&<nav aria-label="Secciones de perfil" className="mb-6 flex items-center justify-center gap-1 border-b border-slate-200 pb-2">
          {([['profile','Perfil'],['category','Categoría']] as const).map(([key,label])=>
           <button type="button" key={key} aria-current={activeTab===key?'page':undefined}
            onClick={()=>{
             if(activeTab===key)return;
             if(activeTab==='profile'&&hasPendingEdits){setPendingTab(key);return;}
             setActiveTab(key);if(key==='category')setVisitedCategory(true);
            }}
            className={'min-w-28 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none '+(activeTab===key?'bg-slate-900 text-white':'text-slate-500 hover:bg-slate-100 hover:text-slate-900')}>
            {label}
           </button>
          )}
        </nav>}
        <div hidden={activeTab!=='profile'}>
        <section className="border-b border-slate-200 pb-6 sm:pb-8">
          <div className="flex items-center gap-4 sm:gap-8">
            <div aria-label={'Iniciales de '+(me.full_name||'usuario')} className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-800 sm:h-32 sm:w-32 sm:text-4xl">
              {initials}
              <span className={cn('absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-white sm:h-5 sm:w-5',me.is_active?'bg-emerald-500':'bg-rose-500')}/>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{me.full_name||'Sin nombre'}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:text-sm">
                <span className="rounded-lg bg-slate-200/70 px-2.5 py-1 font-medium">{roleLabel(me.role)}</span>
                <span className="inline-flex items-center gap-1.5"><span className={cn('h-1.5 w-1.5 rounded-full',me.is_active?'bg-emerald-500':'bg-rose-500')}/>{me.is_active?'Cuenta activa':'Cuenta inactiva'}</span>
              </div>
              {displayEmail&&<div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-500">
                <Mail className="h-4 w-4 shrink-0"/><span className="max-w-full break-all">{me.email}</span>
                <button type="button" onClick={copyEmail} aria-label="Copiar correo" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-600"><Copy className="h-3.5 w-3.5"/>Copiar</button>
              </div>}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{branches.length} {branches.length===1?'sucursal asignada':'sucursales asignadas'}</span>
                {commercialVendor&&<span>Acceso comercial</span>}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-5">
            <CardShell>
              <CardHeader
                icon={<UserRound className="h-4 w-4" />}
                eyebrow="Identidad"
                title="Información personal"
                description=""
              />

              {lockCommercialName ? (
                <div className="mt-5 space-y-2">
                  <label className="block text-[10px] font-medium uppercase tracking-[0.09em] text-slate-400">Nombre del titular</label>
                  <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900">
                    {me.full_name || 'Sin nombre'}
                  </div>
                  <p className="text-[11px] text-slate-500">Administrado desde Personal comercial.</p>
                </div>
              ) : (
              <form onSubmit={saveName} className="mt-5">
                <label htmlFor="profile-display-name" className="mb-2 block text-xs font-medium text-slate-600">
                  Nombre completo
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                     id="profile-display-name"
                     value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={savingName || !nameDirty}
                    className="inline-flex h-11 min-w-[130px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingName ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
              )}
            </CardShell>

            <CardShell>
              <CardHeader
                icon={<Building2 className="h-4 w-4" />}
                eyebrow="Alcance"
                title="Sucursales asignadas"
                description=""
              />

              <div className="mt-5">
                {branches.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-slate-200 bg-[#F8F9FA] px-4 py-6 text-center text-[11px] text-slate-400">
                    No tenés sucursales asignadas.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {branches.map((branch) => (
                      <div
                        key={branch}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2"
                      >
                        <Building2 className="h-4 w-4 text-slate-500"/>
                        <span className="text-xs font-medium text-slate-800">{cap(branch)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-xs text-slate-500">Para cambiar sucursales, contactá a un administrador.</p>
              </div>
            </CardShell>
          </section>

          <section className="space-y-5">
            <CardShell>
              <CardHeader
                icon={<LockKeyhole className="h-4 w-4" />}
                eyebrow="Seguridad"
                title="Cambiar contraseña"
                description=""
              />

              <form onSubmit={savePwd} className="mt-5 space-y-4">
                <PasswordField
                  label="Contraseña actual"
                  value={currentPwd}
                  onChange={setCurrentPwd}
                  visible={showCurrentPwd}
                  onToggle={()=>setShowCurrentPwd(value=>!value)}
                  placeholder="Ingresá tu contraseña actual"
                />
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

                <div className="flex flex-wrap gap-2">
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
                  <div className="flex max-w-md items-start gap-2 text-xs leading-5 text-slate-500">
                    <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Usá una contraseña única que no reutilices en otros servicios.
                  </div>

                  <button
                    type="submit"
                    disabled={savingPwd || !passwordReady}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:opacity-40 sm:w-auto"
                  >
                    <LockKeyhole className="h-3.5 w-3.5" />
                    {savingPwd ? 'Actualizando...' : 'Cambiar contraseña'}
                  </button>
                </div>
              </form>
            </CardShell>

           </section>
        </div>
        </div>
        {commercialVendor&&visitedCategory&&<div hidden={activeTab!=='category'}>
          <CommercialProfileCategories sellerName={me.full_name??''}/>
        </div>}
      </div>
      <AlertDialog open={pendingTab!==null} onOpenChange={open=>{if(!open)setPendingTab(null);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
           <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
           <AlertDialogDescription>Hay campos modificados en Perfil. ¿Querés descartarlos para cambiar de sección?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
           <AlertDialogCancel>Seguir editando</AlertDialogCancel>
           <AlertDialogAction onClick={()=>{
             setCurrentPwd('');setPwd('');setPwd2('');setFullName(me.full_name??'');
             if(pendingTab){setActiveTab(pendingTab);if(pendingTab==='category')setVisitedCategory(true);}
             setPendingTab(null);
           }}>Salir sin guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      {children}
    </section>
  );
}

function CardHeader({ icon,title }: {
  icon: React.ReactNode; eyebrow: string; title: string; description: string;
}) {
  return <div className="flex items-center gap-2.5">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">{icon}</span>
    <h2 className="text-base font-medium text-slate-900">{title}</h2>
  </div>;
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
          autoComplete={label==='Contraseña actual'?'current-password':'new-password'}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-11 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-600"
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
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-200',
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

