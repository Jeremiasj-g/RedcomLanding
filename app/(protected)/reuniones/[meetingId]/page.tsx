import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RequireAuth } from '@/components/RouteGuards';
import { getMockMeeting } from '@/lib/reuniones/mock';
import { formatMeetingTimestamp } from '@/lib/reuniones/types';

export default function Page({ params }: { params: { meetingId: string } }) {
  const meeting = getMockMeeting(params.meetingId);
  if (!meeting) notFound();

  return (
    <RequireAuth roles={['admin', 'jdv', 'supervisor', 'vendedor', 'rrhh']}>
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <Link href="/reuniones" className="text-sm font-bold text-slate-600 hover:text-slate-950">← Volver a reuniones</Link>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {meeting.branches.map((branch) => <span key={branch} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">{branch}</span>)}
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-extrabold text-violet-700">IA simulada</span>
            </div>
            <h1 className="mt-4 text-3xl font-black text-slate-950">{meeting.title}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">{meeting.summary}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Puntos clave</h2>
            <div className="mt-4 space-y-4">
              {meeting.keyPoints.map((point) => (
                <div key={point.id} className="grid gap-2 sm:grid-cols-[70px_1fr]">
                  <span className="font-mono text-xs font-black text-red-600">{formatMeetingTimestamp(point.timestampSeconds)}</span>
                  <div><p className="font-black text-slate-900">{point.title}</p><p className="text-sm text-slate-600">{point.description}</p></div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Transcripción</h2>
            <div className="mt-4 space-y-4">
              {meeting.transcript.map((segment) => (
                <div key={segment.id} className="grid gap-2 sm:grid-cols-[70px_160px_1fr]">
                  <span className="font-mono text-xs font-black text-red-600">{formatMeetingTimestamp(segment.startSeconds)}</span>
                  <span className="text-sm font-black text-slate-900">{segment.speaker}</span>
                  <p className="text-sm text-slate-600">{segment.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </RequireAuth>
  );
}
