import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
import type { Metadata } from 'next';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/Footer';
import FloatingTelegramButton from '@/components/Icons/FloatingTelegramButton';
import AuthProvider from '@/app/auth/AuthProvider';
import ReactToastProvider from '@/components/providers/ReactToastProvider';
import ModulePermissionsProvider from '@/components/permissions/ModulePermissionsProvider';

export const metadata: Metadata = {
  title: 'Redcom',
  description: 'Distribuidora',
  icons: {
    // Usamos el mismo PNG para favicon y apple-touch-icon
    icon: '/LogoRedcom.png',
    apple: '/LogoRedcom.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" />
      </head>

      <body
        style={{
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <AuthProvider>
          <ModulePermissionsProvider>
            <Navbar />
            <main>{children}</main>
            {/* Botón flotante de Telegram */}
            {/* <FloatingTelegramButton /> */}
            <Footer />
            <ReactToastProvider />
          </ModulePermissionsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
