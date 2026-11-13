'use client';
import RequireAuth from '@/app/auth/RequireAuth';
import ModuleAccessGuard from '@/components/permissions/ModuleAccessGuard';
import AnalyticsConfigProvider from '@/components/analytics/AnalyticsConfigProvider';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AnalyticsConfigProvider>
        <ModuleAccessGuard>{children}</ModuleAccessGuard>
      </AnalyticsConfigProvider>
    </RequireAuth>
  );
}
