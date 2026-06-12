'use client';

import { motion } from 'framer-motion';
import Container from './Container';
import Carrusel from './Carrusel';

export default function PageHeader(props) {
  const {
    title,
    subtitle = 'Recursos sucursal',
    bgImage = '',
    bg = ' ',
    bg2 = '',
    actions = null,
    className = '',
  } = props;

  return (
    <header className={`h-[calc(100dvh-64px)] min-h-[420px] overflow-hidden ${className}`}>

      <div className={`relative flex flex-col justify-center gap-10 max-w-7xl mx-auto px-4 py-14 h-full z-10`}>
        <h1 className="text-6xl font-extrabold drop-shadow-sm">
          ¡Bienvenido al espacio <br /> de trabajo de <br /> {title}!
        </h1>

        <p>Aquí podras encontrar todos los recursos necesarios para tu trabajo, <br /> desde planillas hasta herramientas de colaboración. <br /> dashboards y tableros de los ultimos 3 meses cerrados</p>

        <Carrusel />
      </div>




      {/* Fondo */}
      <div className={`absolute inset-0 ${bg}`}>
        <div className={`absolute inset-0 ${bg2}`} />
      </div>

      {/* Card flotante (glass) */}
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute bottom-0 right-0 w-full border h-full"
        >
          <div className={`absolute top-[20%] right-[8%] p-4 overflow-hidden`}>
                {bgImage ? (
                  <img src={bgImage} alt={bgImage} className="h-full w-full drop-shadow-[5px_5px_0px_rgba(0,0,0,.7)]" />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
        </motion.div>
      </Container>
    </header>
  );
}
