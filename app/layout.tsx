import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/Footer';
import FloatingTelegramButton from '@/components/Icons/FloatingTelegramButton';
import AuthProvider from '@/app/auth/AuthProvider';
import ReactToastProvider from '@/components/providers/ReactToastProvider';
import ModulePermissionsProvider from '@/components/permissions/ModulePermissionsProvider';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
});

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
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" />
      </head>

      <body className={inter.className}>
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
