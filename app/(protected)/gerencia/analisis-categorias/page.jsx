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
        bg=""
        bg2="bg-white/10"
        bgImage="/mapa-corrientes.png"
        bgStyle={{
          background:
            'radial-gradient(circle at 12% 18%, rgba(14, 165, 233, 0.72), transparent 30%), radial-gradient(circle at 78% 16%, rgba(220, 38, 38, 0.52), transparent 30%), radial-gradient(circle at 28% 88%, rgba(22, 163, 74, 0.52), transparent 32%), radial-gradient(circle at 88% 82%, rgba(147, 51, 234, 0.58), transparent 32%), linear-gradient(135deg, #f8fafc 0%, #e2e8f0 36%, #0f172a 100%)',
        }}
      />

      <main className="min-h-screen bg-slate-50 py-8 sm:py-10">
        <Container>
          <GerenciaCategoriasDashboard />
        </Container>
      </main>
    </RequireAuth>
  );
}
