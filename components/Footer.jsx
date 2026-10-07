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
    <footer className="relative mt-20 overflow-hidden bg-[#17181b] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[-120px] h-72 w-72 rounded-full bg-sky-400/[0.055] blur-[100px]" />
        <div className="absolute right-[10%] top-[-80px] h-64 w-64 rounded-full bg-violet-400/[0.045] blur-[100px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/[0.08]" />
      </div>

      <Container>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          viewport={{ once: true }}
          className="relative py-10 md:py-12"
        >
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.75fr_0.75fr_0.95fr] lg:gap-10">
            <div className="max-w-lg">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-[13px] border border-white/[0.08] bg-white/[0.045]">
                  <img
                    src="/LogoRedcom.png"
                    alt="Redcom"
                    className="h-7 w-7 object-contain"
                  />
                </div>

                <div>
                  <div className="text-[14px] font-semibold tracking-[0.02em] text-white/[0.94]">
                    REDCOM
                  </div>
                  <div className="-mt-0.5 text-[8px] font-medium uppercase tracking-[0.16em] text-white/[0.24]">
                    Distribución regional
                  </div>
                </div>
              </div>

              <h3 className="mt-6 max-w-md text-[28px] font-medium leading-[1.12] tracking-[-0.035em] text-white/[0.94] md:text-[34px]">
                Distribución comercial con alcance regional.
              </h3>

              <p className="mt-4 max-w-md text-[12px] leading-6 text-white/[0.38] md:text-[13px]">
                Más de 13 años conectando productores, comercios y equipos de venta
                con soluciones de distribución, logística y abastecimiento.
              </p>

              <div className="mt-6 flex items-center gap-2">
                {socialLinks.map((social) => (
                  <motion.a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="group grid h-10 w-10 place-items-center rounded-[12px] border border-white/[0.075] bg-white/[0.035] text-white/[0.42] transition hover:border-white/[0.12] hover:bg-white/[0.065] hover:text-white/[0.82]"
                  >
                    <span className="h-[18px] w-[18px]">
                      {social.icon}
                    </span>
                  </motion.a>
                ))}
              </div>
            </div>

            <FooterColumn title="Servicios">
              {services.map((service) => (
                <li key={service}>
                  <span className="text-[11px] leading-5 text-white/[0.42]">
                    {service}
                  </span>
                </li>
              ))}
            </FooterColumn>

            <FooterColumn title="Sucursales">
              {branches.map((branch) => (
                <li key={branch}>
                  <span className="text-[11px] leading-5 text-white/[0.42]">
                    {branch}
                  </span>
                </li>
              ))}
            </FooterColumn>

            <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="text-[9px] font-medium uppercase tracking-[0.11em] text-white/[0.28]">
                Contacto
              </div>

              <div className="mt-4 space-y-4">
                <InfoRow
                  label="Teléfono"
                  value="+54 379 4524304"
                />
                <InfoRow
                  label="Atención"
                  value="Lunes a sábados"
                />
              </div>

              <a
                href="https://wa.me/543794524304"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex h-9 w-full items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.05] px-3 text-[10px] font-medium text-white/[0.66] transition hover:bg-white/[0.085] hover:text-white"
              >
                Contactar por WhatsApp
              </a>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="mt-10 flex flex-col gap-3 border-t border-white/[0.065] pt-5 text-[10px] text-white/[0.25] sm:flex-row sm:items-center sm:justify-between"
          >
            <p>© 2026 Redcom. Todos los derechos reservados.</p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>13+ años distribuyendo calidad.</span>
              <span className="hidden h-3 w-px bg-white/[0.08] sm:block" />
              <span className="text-white/[0.18]">Corrientes · Chaco · Misiones · Oberá</span>
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </footer>
  );
};

function FooterColumn({ title, children }) {
  return (
    <div className="pt-1">
      <h4 className="mb-4 text-[9px] font-medium uppercase tracking-[0.11em] text-white/[0.28]">
        {title}
      </h4>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="text-[8px] font-medium uppercase tracking-[0.10em] text-white/[0.22]">
        {label}
      </div>
      <div className="mt-1 text-[11px] font-medium text-white/[0.68]">
        {value}
      </div>
    </div>
  );
}

export default Footer;
