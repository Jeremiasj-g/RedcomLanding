import React from 'react'
import Container from '@/components/Container'
import { RequireAuth } from '@/components/RouteGuards'
import CategoriasTable from './CategoriasTable'
import CategoriaVendorHistory from './CategoriaVendorHistory'
import styles from './CategoriasHistoryPage.module.css'

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
  heroBgUrl = '/categorias.webp',
  heroHeightClass = 'h-[350px]',
  heroExtraClassName = '',
  heroHasShadow = true,
  heroBottomOffsetClass = 'translate-y-[50%]',
}: Props) {
  return (
    <RequireAuth roles={roles} branches={branches}>
      <main className={`min-h-screen bg-slate-50 pb-16 ${styles.historyTypography}`}>
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

        <Container className={`pt-28 md:pt-32 !max-w-[1500px] ${styles.historyContainer}`}>
          <CategoriaVendorHistory />
        </Container>
      </main>
    </RequireAuth>
  )
}
