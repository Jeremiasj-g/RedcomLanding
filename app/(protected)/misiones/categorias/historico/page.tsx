import React from 'react'
import CategoriasHistoryPage from '@/components/categoria/CategoriasHistoryPage'

export default function Page() {
  return (
    <CategoriasHistoryPage
      roles={['admin', 'supervisor', 'jdv', 'vendedor', 'rrhh']}
      branches={['misiones']}
      backHref="/misiones/categorias"
      branchLabel="Misiones · Masivos"
    />
  )
}
