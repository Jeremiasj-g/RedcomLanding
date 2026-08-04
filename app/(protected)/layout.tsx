'use client';
import RequireAuth from '@/app/auth/RequireAuth';
import ModuleAccessGuard from '@/components/permissions/ModuleAccessGuard';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <ModuleAccessGuard>{children}</ModuleAccessGuard>
    </RequireAuth>
  );
}
