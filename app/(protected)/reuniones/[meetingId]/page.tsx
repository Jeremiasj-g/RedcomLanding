import { notFound } from 'next/navigation';
import { RequireAuth } from '@/components/RouteGuards';
import ReunionDetail from '@/components/reuniones/ReunionDetail';
import { getMockMeeting } from '@/lib/reuniones/mock';

export default function Page({ params }: { params: { meetingId: string } }) {
  const meeting = getMockMeeting(params.meetingId);
  if (!meeting) notFound();

  return (
    <RequireAuth roles={['admin', 'jdv', 'supervisor', 'vendedor', 'rrhh']}>
      <ReunionDetail meeting={meeting} />
    </RequireAuth>
  );
}
