import React from 'react'
import CategoriasTable from '@/components/categoria/CategoriasTable'
import CategoriasGrid from '@/components/categoria/CategoriasGrid'
import CategoriasLayout from '@/components/categoria/CategoriasLayout'

export default function Page() {
  return (
    <CategoriasLayout
      roles={['admin', 'supervisor', 'jdv' ,'vendedor', 'rrhh']}
      branches={['chaco']}
      heroBgUrl="/categorias.webp"
      heroHasShadow
      table={<CategoriasTable />}
      grid={<CategoriasGrid />}
    />
  )
}
