import React from 'react'
import Container from '@/components/Container'
import { RequireAuth } from '@/components/RouteGuards'

type Props = {
  roles: Array<'admin' | 'supervisor' | 'vendedor'>
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
}

export default function CategoriasLayout({
  roles,
  branches,
  heroBgUrl = "/categorias.webp",
  heroHeightClass = "h-[350px]",
  heroExtraClassName = "",
  heroHasShadow = true,
  heroBottomOffsetClass = "translate-y-[50%]",
  sectionClassName = "mt-40 mb-24",
  containerClassName = "",
  table,
  grid,
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

      <section className={sectionClassName}>
        <Container className={containerClassName as any}>
          {grid}
        </Container>
      </section>
    </RequireAuth>
  )
}
