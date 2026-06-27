import React from 'react'
import Link from 'next/link'
import Container from '@/components/Container'
import { RequireAuth } from '@/components/RouteGuards'
import CategoriasTable from './CategoriasTable'
import CategoriaVendorHistory from './CategoriaVendorHistory'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
          <Card className="mb-8 overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-red-100 bg-red-50 text-[11px] font-black uppercase tracking-[0.20em] text-red-700">
                      Categorías
                    </Badge>
                    <Badge variant="secondary" className="rounded-full bg-slate-100 text-xs font-black text-slate-700 hover:bg-slate-100">
                      {branchLabel}
                    </Badge>
                  </div>

                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                    Histórico de vendedores
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 md:text-base">
                    Consultá la evolución mensual, compará vendedores y revisá el rendimiento por supervisor.
                  </p>
                </div>

                <Button asChild variant="outline" className="h-12 rounded-2xl border-slate-200 px-5 text-sm font-extrabold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-600">
                  <Link href={backHref}>Volver a categorías</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <CategoriaVendorHistory />
        </Container>
      </main>
    </RequireAuth>
  )
}
