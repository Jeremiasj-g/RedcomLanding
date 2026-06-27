'use client';

import Container from '@/components/Container';
import GerenciaCategoriasDashboard from '@/components/categoria/GerenciaCategoriasDashboard';
import PageHeader from '@/components/PageHeader';
import { RequireAuth } from '@/components/RouteGuards';

export default function AnalisisCategoriasGerencia() {
  return (
    <RequireAuth roles={['admin']}>
      <PageHeader
        title="Análisis de categorías"
        bg="bg-gradient-to-tl from-slate-900 via-slate-800 to-transparent to-[60%]"
        bg2="bg-gradient-to-bl from-red-500/60 from-0% via-[18%] to-transparent to-[36%]"
        bgImage="/mapa-corrientes.png"
      />

      <main className="min-h-screen bg-slate-50 py-8 sm:py-10">
        <Container>
          <GerenciaCategoriasDashboard />
        </Container>
      </main>
    </RequireAuth>
  );
}
