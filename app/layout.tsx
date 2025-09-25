import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FloatingTelegramButton from '@/components/Icons/FloatingTelegramButton';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        <Navbar />
        <main>{children}</main>
        {/* Botón flotante de Telegram */}
        <FloatingTelegramButton />
        <Footer />
      </body>
    </html>
  );
}
