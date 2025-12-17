import React from 'react'
import CategoriasTable from '@/components/categoria/CategoriasTable'
import Container from '@/components/Container'
import CategoriasGrid from '@/components/categoria/CategoriasGrid'
import { RequireAuth } from '@/components/RouteGuards'

const page = () => {
    return (
        <RequireAuth
            roles={['admin', 'supervisor', 'vendedor']}
            branches={['corrientes']}
        >
            <div className="hero relative h-[350px] w-full bg-[url('/categorias.png')] bg-cover bg-bottom">
                <div className='absolute bottom-0 translate-y-[50%] left-[50%] translate-x-[-50%] z-10'>
                    <CategoriasTable />
                </div>
            </div>
            <section className='mt-40 mb-24"'>
                <Container>
                    <CategoriasGrid />
                </Container>
            </section>
        </RequireAuth>
    )
}

export default page