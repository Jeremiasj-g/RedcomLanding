import React from 'react'
import Link from 'next/link'
import { ArrowRight, History } from 'lucide-react'
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
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <History className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                Compará la evolución mensual por vendedor.
              </p>
            </div>

            <Link
              href={historyHref}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-extrabold text-white transition hover:bg-red-600"
            >
              Analizar histórico
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
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
