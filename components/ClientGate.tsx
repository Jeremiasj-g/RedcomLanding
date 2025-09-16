'use client';

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";                   // 👈 iconos
import { GATE_HASH, GATE_TTL_MS, sha256Hex, gateKey, getSaved } from "@/lib/gate";

export default function ClientGate({
  area,
  children,
}: { area: keyof typeof GATE_HASH; children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);              // 👈 estado ojo
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = getSaved(area);
    if (saved) setUnlocked(true);
    document.body.style.overflow = saved ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [area]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const expected = GATE_HASH[area];
      const hash = await sha256Hex(pwd);
      if (hash === expected) {
        localStorage.setItem(gateKey(area), JSON.stringify({ exp: Date.now() + GATE_TTL_MS }));
        setUnlocked(true);
        document.body.style.overflow = "";
      } else {
        setErr("Contraseña inválida");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {children}
      <AnimatePresence>
        {!unlocked && (
          <motion.div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            aria-modal="true" role="dialog"
          >
            <motion.form
              onSubmit={submit}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-[#121316] border border-white/10 p-6 text-white shadow-2xl"
            >
              <h3 className="text-lg font-semibold mb-1">Acceso restringido</h3>
              <p className="text-white/60 text-sm mb-4">Ingresá la contraseña para continuar.</p>

              {/* Input + botón ojo */}
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 pr-11
                             focus:outline-none focus:ring-2 focus:ring-rose-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg
                             hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  {showPwd ? <EyeOff className="h-5 w-5 text-white/70" /> : <Eye className="h-5 w-5 text-white/70" />}
                </button>
              </div>

              {err && <p className="text-rose-400 text-sm mt-2">{err}</p>}

              {/* Desbloquear */}
              <button
                type="submit"
                disabled={busy}
                className="mt-4 w-full rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-60 px-4 py-2 font-medium"
              >
                {busy ? "Verificando…" : "Desbloquear"}
              </button>

              {/* Volver al inicio (no cierra el gate) */}
              <button
                type="button"
                onClick={() => router.replace('/')}
                className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 font-medium text-white"
                aria-label="Volver al menú principal"
              >
                Volver al menú principal
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
