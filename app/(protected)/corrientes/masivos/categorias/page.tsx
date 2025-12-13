import React from 'react'
import CategoriasTable from './CategoriasTable'
import Container from '@/components/Container'

const page = () => {
    return (
        <section className='mt-24 mb-24"'>
            <Container>
                <CategoriasTable />
            </Container>
        </section>
    )
}

export default page