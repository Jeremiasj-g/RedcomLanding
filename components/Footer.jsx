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
    <footer className="border-t border-slate-200 bg-[#F7F7F8] text-slate-600">
      <Container>
        <div className="py-8 sm:py-10">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 text-sm lg:grid-cols-[1.4fr_1fr_0.8fr_1fr]">
            <div className="col-span-2 lg:col-span-1">
              <p className="text-lg font-semibold tracking-tight text-slate-900">Redcom S.A.</p>
              <p className="mt-2 max-w-xs leading-relaxed">
                Distribución comercial y logística con alcance regional.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 motion-reduce:transition-none"
                  >
                    <span className="h-5 w-5">{social.icon}</span>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Servicios</h2>
              <ul className="space-y-2">
                {services.map((service) => <li key={service}>{service}</li>)}
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Sucursales</h2>
              <ul className="space-y-2">
                {branches.map((branch) => <li key={branch}>{branch}</li>)}
              </ul>
            </div>

            <div className="col-span-2 lg:col-span-1">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Contacto</h2>
              <address className="space-y-2 not-italic">
                <a href="tel:+543794524304" className="inline-flex min-h-8 items-center rounded text-slate-700 transition-colors duration-200 hover:text-slate-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 motion-reduce:transition-none">
                  +54 379 4524304
                </a>
                <p>Lunes a sábados</p>
              </address>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Redcom. Todos los derechos reservados.</p>
            <p>Más de 13 años de trayectoria.</p>
          </div>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
