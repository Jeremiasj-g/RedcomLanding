'use client';
import RequireAuth from '@/app/auth/RequireAuth';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
