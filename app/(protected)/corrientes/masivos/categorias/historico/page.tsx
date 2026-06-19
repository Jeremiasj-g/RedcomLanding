import React from 'react'
import CategoriasHistoryPage from '@/components/categoria/CategoriasHistoryPage'

export default function Page() {
  return (
    <CategoriasHistoryPage
      roles={['admin', 'supervisor', 'jdv', 'vendedor', 'rrhh']}
      branches={['corrientes']}
      backHref="/corrientes/masivos/categorias"
      branchLabel="Corrientes · Masivos"
    />
  )
}
