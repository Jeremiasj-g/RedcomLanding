'use client';

import { RequireAuth } from '@/components/RouteGuards';
import Container from '@/components/Container';
import PageHeader from '@/components/PageHeader';
import FocosFeed from './FocosFeed';

export default function FocosPageClient() {
  return (
    <RequireAuth>
      <Container>
        <div className='relative px-4 py-6 mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm'>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-900 shadow-sm">
            Seccion de focos
          </div>

          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Seguimiento y cumplimiento de focos diarios y semanales.
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Completa focos/criticos.
          </p>
        </div>

        <div className="mt-6">
          <FocosFeed />
        </div>
      </Container>
    </RequireAuth>
  );
}
