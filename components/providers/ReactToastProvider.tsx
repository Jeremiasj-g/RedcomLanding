'use client';

import { useEffect } from 'react';
import { Slide, ToastContainer, toast } from 'react-toastify';

/**
 * Contenedor global de notificaciones de REDCOM.
 * Se monta una sola vez desde app/layout.tsx y permite usar `notify`
 * desde cualquier componente cliente del proyecto.
 */
export default function ReactToastProvider() {
  useEffect(() => {
    // Puente para runtimes JS que no forman parte del árbol TypeScript,
    // como los dashboards que se inicializan de forma dinámica.
    window.__redcomToast = {
      success: (message) => toast.success(message),
      error: (message) => toast.error(message),
      warning: (message) => toast.warning(message),
      info: (message) => toast.info(message),
    };

    return () => {
      delete window.__redcomToast;
    };
  }, []);

  return (
    <ToastContainer
      position="top-right"
      autoClose={3400}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
      transition={Slide}
      limit={5}
      className="redcom-toast-container"
      toastClassName="redcom-toast"
      bodyClassName="redcom-toast-body"
      progressClassName="redcom-toast-progress"
    />
  );
}

declare global {
  interface Window {
    __redcomToast?: {
      success: (message: string) => void;
      error: (message: string) => void;
      warning: (message: string) => void;
      info: (message: string) => void;
    };
  }
}
