'use client';

import { motion } from 'framer-motion';
import Container from './Container';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12 mt-24">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {/* Company Info */}
          <div>
            <h3 className="text-2xl font-bold mb-4">Redcom</h3>
            <p className="text-gray-400 mb-4">
              Distribuidora de productos con más de 13 años de experiencia en el rubro.
              Conectamos productores y comercios en toda la región.
            </p>
            <div className="flex space-x-4">
              <motion.a
                whileHover={{ scale: 1.1 }}
                href="#"
                className="text-gray-400 hover:text-rose-500 transition-colors duration-300"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.1 }}
                href="#"
                className="text-gray-400 hover:text-rose-500 transition-colors duration-300"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22 12.07C22 6.5 17.52 2 12 2S2 6.5 2 12.07C2 17.1 5.66 21.26 10.44 22v-7.03H7.9v-2.9h2.54V9.41c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.25c-1.23 0-1.61.76-1.61 1.54v1.85h2.74l-.44 2.9h-2.3V22C18.34 21.26 22 17.1 22 12.07z" />
                </svg>
              </motion.a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-rose-400">Servicios</h4>
            <ul className="space-y-2 text-gray-400">
              <li>Distribución mayorista</li>
              <li>Logística refrigerada</li>
              <li>Almacenamiento</li>
              <li>Transporte regional</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-rose-400">Contacto</h4>
            <div className="space-y-2 text-gray-400">
              <p>📞 +54 XXX XXX-XXXX</p>
              <p>📧 info@redcom.com.ar</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400"
        >
          <p>&copy; 2025 Redcom. Todos los derechos reservados. 13+ años distribuyendo calidad.</p>
        </motion.div>
      </Container>
    </footer>
  );
};

export default Footer;