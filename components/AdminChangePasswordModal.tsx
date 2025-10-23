'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
    open: boolean;
    onClose: () => void;
    userId: string | null;
    userEmail?: string;
    onChanged?: () => void; // callback al éxito
};

export default function AdminChangePasswordModal({
    open,
    onClose,
    userId,
    userEmail,
    onChanged,
}: Props) {
    const [pwd, setPwd] = useState('');
    const [pwd2, setPwd2] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);


    useEffect(() => {
        if (open) {
            setPwd('');
            setPwd2('');
            setErr(null);
        }
    }, [open]);

    if (!open) return null;

    const submit = async () => {
        setErr(null);
        if (!userId) return;
        if (pwd.length < 8) {
            setErr('La contraseña debe tener al menos 8 caracteres');
            return;
        }
        if (pwd !== pwd2) {
            setErr('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        // ⚠️ Invocamos la Edge Function (usa SERVICE_ROLE en el server)
        const { data, error } = await supabase.functions.invoke('admin_set_password', {
            body: { user_id: userId!, password: pwd },
            // Si tu proyecto requiere pasar apikey/Authorization explícitos, descomenta:
            // headers: {
            //   apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
            //   Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string}`,
            // },
        });

        setLoading(false);

        if (error) {
            // error.message viene del status no-2xx del edge runtime
            setErr(error.message || 'Error al cambiar la contraseña');
            return;
        }
        if (!data?.ok) {
            // si la función devolvió JSON con {error, status}
            setErr(data?.error || 'Falló el cambio de contraseña');
            return;
        }

        onChanged?.();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={!loading ? onClose : undefined} />
            <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl border">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Cambiar contraseña</h3>
                {userEmail && <p className="text-sm text-slate-600 mb-4">{userEmail}</p>}

                <div className="space-y-3">
                    <input
                        type="password"
                        placeholder="Nueva contraseña"
                        className="w-full rounded-lg border px-3 py-2"
                        value={pwd}
                        onChange={(e) => setPwd(e.target.value)}
                        disabled={loading}
                    />
                    <input
                        type="password"
                        placeholder="Repetir contraseña"
                        className="w-full rounded-lg border px-3 py-2"
                        value={pwd2}
                        onChange={(e) => setPwd2(e.target.value)}
                        disabled={loading}
                    />
                    {err && <p className="text-sm text-red-600">{err}</p>}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        className="rounded-lg border px-4 py-2 hover:bg-slate-50"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        className={`rounded-lg px-4 py-2 text-white ${loading ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'
                            }`}
                        onClick={submit}
                        disabled={loading}
                    >
                        {loading ? 'Guardando…' : 'Cambiar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
