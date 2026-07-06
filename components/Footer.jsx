'use client';

import { motion } from 'framer-motion';
import Container from './Container';

const socialLinks = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/redcomargentina?igsh=MXBndTlxZmozMDR3eQ==',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/redcomdistribuidora',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22 12.07C22 6.5 17.52 2 12 2S2 6.5 2 12.07C2 17.1 5.66 21.26 10.44 22v-7.03H7.9v-2.9h2.54V9.41c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.25c-1.23 0-1.61.76-1.61 1.54v1.85h2.74l-.44 2.9h-2.3V22C18.34 21.26 22 17.1 22 12.07z" />
      </svg>
    ),
  },
  {
    name: 'WhatsApp',
    href: 'https://wa.me/543794524304',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.57 2 2.12 6.36 2.12 11.73c0 1.9.56 3.67 1.53 5.16L2 22l5.27-1.62a10.08 10.08 0 0 0 4.77 1.2c5.47 0 9.92-4.36 9.92-9.73S17.51 2 12.04 2Zm0 17.9a8.35 8.35 0 0 1-4.25-1.16l-.3-.18-3.13.96.98-3-.2-.31a7.96 7.96 0 0 1-1.32-4.48c0-4.43 3.69-8.04 8.22-8.04s8.22 3.61 8.22 8.04-3.69 8.17-8.22 8.17Zm4.5-6.05c-.25-.12-1.46-.71-1.69-.79-.23-.08-.39-.12-.56.12-.16.24-.64.79-.79.95-.14.16-.29.18-.54.06-.25-.12-1.05-.38-2-1.2-.74-.65-1.24-1.45-1.39-1.69-.14-.24-.02-.37.11-.49.11-.11.25-.29.37-.43.12-.14.16-.24.25-.4.08-.16.04-.3-.02-.43-.06-.12-.56-1.33-.77-1.82-.2-.48-.41-.41-.56-.42h-.48c-.16 0-.43.06-.66.3-.23.24-.87.85-.87 2.06 0 1.21.89 2.38 1.02 2.55.12.16 1.75 2.63 4.25 3.69.59.25 1.05.4 1.41.51.59.18 1.13.16 1.56.1.48-.07 1.46-.59 1.67-1.15.21-.57.21-1.05.14-1.15-.06-.1-.23-.16-.48-.28Z" />
      </svg>
    ),
  },
];

const services = [
  'Distribución mayorista',
  'Logística refrigerada',
  'Almacenamiento',
  'Transporte regional',
];

const branches = ['Corrientes', 'Chaco', 'Misiones', 'Oberá'];

const Footer = () => {
  return (
    <footer className="relative overflow-hidden bg-[#080B12] text-white md:mt-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-red-600/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <Container>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          viewport={{ once: true }}
          className="relative py-14 md:py-16"
        >
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.3fr_0.8fr_0.8fr_1fr]">
            <div className="max-w-md">
              <div className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-red-300">
                Redcom S.A.
              </div>

              <h3 className="text-3xl font-black tracking-tight md:text-4xl">
                Distribución comercial con alcance regional.
              </h3>

              <p className="mt-4 text-sm leading-7 text-slate-400 md:text-base">
                Más de 13 años conectando productores, comercios y equipos de venta
                con soluciones de distribución, logística y abastecimiento.
              </p>

              <div className="mt-7 flex items-center gap-3">
                {socialLinks.map((social) => (
                  <motion.a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    whileHover={{ y: -3, scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="group flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300 shadow-lg shadow-black/20 transition-all duration-300 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <span className="h-7 w-7 transition-transform duration-300 group-hover:scale-110">
                      {social.icon}
                    </span>
                  </motion.a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-5 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                Servicios
              </h4>

              <ul className="space-y-3">
                {services.map((service) => (
                  <li key={service} className="text-sm font-semibold text-slate-300">
                    {service}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-5 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                Sucursales
              </h4>

              <ul className="space-y-3">
                {branches.map((branch) => (
                  <li key={branch} className="text-sm font-semibold text-slate-300">
                    {branch}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur">
              <h4 className="text-xs font-black uppercase tracking-[0.24em] text-red-300">
                Contacto
              </h4>

              <div className="mt-5 space-y-4 text-sm text-slate-300">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Teléfono
                  </p>
                  <p className="mt-1 font-semibold">+54 379 4524304</p>
                </div>

                {/* <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Email
                  </p>
                  <p className="mt-1 font-semibold">info@redcom.com.ar</p>
                </div> */}

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Atención
                  </p>
                  <p className="mt-1 font-semibold">Lunes a sábados</p>
                </div>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            viewport={{ once: true }}
            className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-7 text-sm text-slate-500 md:flex-row md:items-center md:justify-between"
          >
            <p>
              © 2026 Redcom. Todos los derechos reservados.
            </p>

            <p className="font-semibold text-slate-400">
              13+ años distribuyendo calidad.
            </p>
          </motion.div>
        </motion.div>
      </Container>
    </footer>
  );
};

export default Footer;