import Container from '@/components/Container'
import { RequireAuth } from '@/components/RouteGuards'
import React from 'react'
import CategoriasTable from '@/components/categoria/CategoriasTable'
import CategoriasGrid from '@/components/categoria/CategoriasGrid'

const page = () => {
  return (
    <RequireAuth
      roles={['admin', 'supervisor', 'vendedor']}
      branches={['corrientes']}
    >
      <section className='mt-24 mb-24'>
        <Container>
          <CategoriasTable />
        </Container>

        <Container>
          <CategoriasGrid />
        </Container>
      </section>
    </RequireAuth>
  )
}

export default page