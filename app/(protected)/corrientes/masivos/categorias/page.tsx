import BranchSigoEntry from '@/components/category-panel/BranchSigoEntry';
import React from 'react'
import CategoriasTable from '@/components/categoria/CategoriasTable'
import CategoriasGrid from '@/components/categoria/CategoriasGrid'
import CategoriasLayout from '@/components/categoria/CategoriasLayout'

export default function Page() {
  return (
   <>
    <BranchSigoEntry branchKey="corrientes" href="/corrientes/masivos/horarios-sigo"/>
    <CategoriasLayout
      roles={['admin', 'supervisor', 'jdv' ,'vendedor', 'rrhh']}
      branches={['corrientes']}
      heroBgUrl="/categorias.webp"
      heroHasShadow
      table={<CategoriasTable />}
      grid={<CategoriasGrid />}
      historyHref="/corrientes/masivos/categorias/historico"
    />
   </>
  )
}
