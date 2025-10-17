'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { IconMapPoint } from '@/components/Icons/IconMapPoint';

type FullScreenEmbedCardProps = {
    title: string;
    description?: string;
    embedUrl?: string;
    icon?: React.ReactNode;
    buttonLabel?: string;
    preload?: boolean;         // si true, monta el iframe al cargar (oculto) para evitar recarga
    className?: string;        // estilos extra para el wrapper <section>
};

type UrlTypes = {
    masivos?: string,
    refrigerados?: string,
    chaco?: string,
    misiones?: string,
    obera?: string,
    gerencia?: string
}

export default function FullScreenEmbedCard({
    title,
    description = 'Visualizá el contenido en pantalla completa.',
    embedUrl,
    icon,
    buttonLabel = 'Abrir',
    preload = false,
    className = '',
}: FullScreenEmbedCardProps) {

    const MAP_URLS = {
        masivos: 'https://www.google.com/maps/d/u/0/embed?mid=1dswZoPN46Tw75GZOd2latT9AdKe0y8M&ehbc=2E312F',
        refrigerados: '',
        chaco: 'https://www.google.com/maps/d/embed?mid=1pUyjtXDwn9iylKJ4nBPSzp1-6LArvho&ehbc=2E312F',
        misiones: 'https://www.google.com/maps/d/u/0/embed?mid=1h1E8r7uu-jsySRjaEHpERx72CpNIISg&ehbc=2E312F',
        obera: '',
        gerencia: 'https://www.google.com/maps/d/u/0/embed?mid=19y6MniEXtnVs3QBIZOlaXGOnkRMVTkI&ehbc=2E312F'
    } as const satisfies UrlTypes;

    const [visible, setVisible] = useState(false);   // mostrar/ocultar (sin desmontar)
    const [mounted, setMounted] = useState(preload); // si preload=true, ya arranca montado

    // abrir/cerrar
    const open = () => {
        if (!mounted) setMounted(true);
        setVisible(true);
    };
    const close = useCallback(() => setVisible(false), []);

    // ESC para cerrar
    useEffect(() => {
        if (!visible) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [visible, close]);

    return (
        <>
            {/* Card disparador */}
            <section className={className}>
                <motion.button
                    onClick={open}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="group w-full"
                >
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl transition-transform duration-200 group-hover:scale-105">
                        <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(1200px_200px_at_50%_-20%,rgba(59,130,246,0.20),transparent)]" />
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                                {icon ?? <IconMapPoint className="h-6 w-6 text-cyan-300" />}
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="text-lg font-semibold text-white tracking-tight">
                                    {title}
                                </h3>
                                <p className="text-sm text-white/70">{description}</p>
                            </div>
                            <div
                                aria-hidden
                                className="ml-auto rounded-full px-3 py-1 text-xs font-medium text-cyan-300/90 ring-1 ring-cyan-400/30 group-hover:ring-cyan-300/60"
                            >
                                {buttonLabel}
                            </div>
                        </div>
                    </div>
                </motion.button>
            </section>

            {/* Modal full-screen: queda montada si mounted=true; solo cambia visibilidad */}
            {mounted && (
                <div
                    className={`fixed inset-0 z-[999] transition-opacity duration-300 ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                        } bg-black/80 backdrop-blur-sm`}
                    role="dialog"
                    aria-modal="true"
                    aria-hidden={!visible}
                >
                    {/* Cerrar al clickear el fondo */}
                    <div className="absolute inset-0" onClick={close} />

                    <div className="relative mx-auto h-screen w-screen">
                        <button
                            onClick={close}
                            className="absolute right-4 top-4 z-[1000] rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/15"
                        >
                            Cerrar
                        </button>

                        {/* Iframe siempre montado (no se desmonta al cerrar) */}
                        <iframe
                            title={title}
                            src={MAP_URLS[embedUrl]}
                            className={`h-full w-full ${visible ? '' : 'invisible'}`}
                            loading={preload ? 'eager' : 'lazy'}
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
