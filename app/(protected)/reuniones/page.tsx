import ReunionesHome from '@/components/reuniones/ReunionesHome';
import { RequireAuth } from '@/components/RouteGuards';

export default function Page() {
  return (
    <RequireAuth roles={['admin', 'jdv', 'supervisor', 'vendedor', 'rrhh']}>
      <ReunionesHome />
    </RequireAuth>
  );
}
