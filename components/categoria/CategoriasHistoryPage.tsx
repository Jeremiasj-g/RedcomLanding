import React from 'react'
import Link from 'next/link'
import Container from '@/components/Container'
import { RequireAuth } from '@/components/RouteGuards'
import CategoriasTable from './CategoriasTable'
import CategoriaVendorHistory from './CategoriaVendorHistory'

type Props = {
  roles: Array<'admin' | 'supervisor' | 'vendedor' | 'rrhh' | 'jdv'>
  branches: string[]
  backHref: string
  branchLabel: string
  heroBgUrl?: string
  heroHeightClass?: string
  heroExtraClassName?: string
  heroHasShadow?: boolean
  heroBottomOffsetClass?: string
}

export default function CategoriasHistoryPage({
  roles,
  branches,
  backHref,
  branchLabel,
  heroBgUrl = '/categorias.webp',
  heroHeightClass = 'h-[350px]',
  heroExtraClassName = '',
  heroHasShadow = true,
  heroBottomOffsetClass = 'translate-y-[50%]',
}: Props) {
  return (
    <RequireAuth roles={roles} branches={branches}>
      <main className="min-h-screen bg-slate-50 pb-16">
        <div
          className={[
            'hero relative w-full bg-cover bg-bottom',
            heroHeightClass,
            heroHasShadow ? 'shadow-2xl' : '',
            heroExtraClassName,
          ].join(' ')}
          style={{ backgroundImage: `url('${heroBgUrl}')` }}
        >
          <div
            className={[
              'absolute bottom-0 left-1/2 z-10 -translate-x-1/2',
              heroBottomOffsetClass,
            ].join(' ')}
          >
            <CategoriasTable />
          </div>
        </div>

        <Container className="pt-28 md:pt-32">
          <section className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-red-600">
                  Dashboard histórico
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                  Evolución histórica de vendedores
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 md:text-base">
                  Analizá la evolución mensual por ID de vendedor en {branchLabel}. Revisá de forma rápida
                  categorías, eficiencia, efectividad, facturación, volumen, cobertura y horas de ruta.
                </p>
              </div>

              <Link
                href={backHref}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-600"
              >
                Volver a categorías
              </Link>
            </div>
          </section>

          <CategoriaVendorHistory />
        </Container>
      </main>
    </RequireAuth>
  )
}
