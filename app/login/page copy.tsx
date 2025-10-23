'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoading(false);
      if (data.session) router.replace('/app');
    });
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return setError(error.message);

  // Chequear perfil activo
  const userId = signInData.user?.id;
  const { data: prof, error: pErr } = await supabase
    .from('profiles')
    .select('is_active, full_name')
    .eq('id', userId)
    .single();

  if (pErr) {
    // si hay error leyendo el perfil, por seguridad cerramos sesión
    await supabase.auth.signOut();
    return setError('No se pudo validar tu cuenta. Intentá de nuevo.');
  }

  if (!prof?.is_active) {
    await supabase.auth.signOut();
    return setError('Tu usuario está inactivo. Consultá con un administrador.');
  }

  // ok
  router.replace('/app');
  router.refresh();
};


  if (loading) return <div className="min-h-[60vh] grid place-items-center">Cargando…</div>;

  return (
    <section className="min-h-[70vh] flex items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border bg-white/50 p-6 shadow-sm backdrop-blur">
        <h1 className="mb-4 text-2xl font-bold">Ingresar</h1>
        <div className="space-y-3">
          <input
            type="email"
            className="w-full rounded-xl border px-4 py-2 outline-none focus:ring"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-xl border px-4 py-2 outline-none focus:ring"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="w-full rounded-xl bg-emerald-600 py-2 font-semibold text-white hover:bg-emerald-700 transition-colors">
            Entrar
          </button>
        </div>
      </form>
    </section>
  );
}
