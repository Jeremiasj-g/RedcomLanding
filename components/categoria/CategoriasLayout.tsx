import React from 'react'
import Link from 'next/link'
import Container from '@/components/Container'
import { RequireAuth } from '@/components/RouteGuards'
import CategoriasFreezeDetector from './CategoriasFreezeDetector'

type Props = {
  roles: Array<'admin' | 'supervisor' | 'vendedor' | 'rrhh' | 'jdv' >
  branches: string[]
  heroBgUrl?: string
  heroHeightClass?: string
  heroExtraClassName?: string
  heroHasShadow?: boolean
  heroBottomOffsetClass?: string
  sectionClassName?: string
  containerClassName?: string
  table: React.ReactNode
  grid: React.ReactNode
  historyHref?: string
}

export default function CategoriasLayout({
  roles,
  branches,
  heroBgUrl = "/categorias.webp",
  heroHeightClass = "h-[350px]",
  heroExtraClassName = "",
  heroHasShadow = true,
  heroBottomOffsetClass = "translate-y-[50%]",
  sectionClassName = "mt-10 mb-24",
  containerClassName = "",
  table,
  grid,
  historyHref,
}: Props) {
  return (
    <RequireAuth roles={roles} branches={branches}>
      <div
        className={[
          "hero relative w-full bg-cover bg-bottom",
          heroHeightClass,
          heroHasShadow ? "shadow-2xl" : "",
          heroExtraClassName,
        ].join(" ")}
        style={{ backgroundImage: `url('${heroBgUrl}')` }}
      >
        <div
          className={[
            "absolute bottom-0 left-1/2 -translate-x-1/2 z-10",
            heroBottomOffsetClass,
          ].join(" ")}
        >
          {table}
        </div>
      </div>

      <Container>
        <CategoriasFreezeDetector />

        {historyHref ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-red-600">
                  Histórico de categorías
                </p>
                <h2 className="mt-2 text-xl font-black text-slate-950 md:text-2xl">
                  Analizá la evolución mensual de un vendedor
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Consultá la evolución por ID de vendedor, compará meses cerrados y revisá
                  categorías, eficiencia, efectividad, facturación, volumen y cobertura.
                </p>
              </div>

              <Link
                href={historyHref}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-red-600"
              >
                Analizar histórico
              </Link>
            </div>
          </div>
        ) : null}
      </Container>

      <section className={sectionClassName}>
        <Container className={containerClassName as any}>
          {grid}
        </Container>
      </section>
    </RequireAuth>
  )
}
