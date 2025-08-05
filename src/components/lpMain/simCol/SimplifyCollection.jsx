import Image from 'next/image'
import React from 'react'
import simColImage from '../../../assets/sim_col_image.png'
import Button from '@/components/Button'

const SimplifyCollection = () => {
    return (
        <section className='py-12 px-8 flex md:flex-row flex-col-reverse justify-between items-center gap-3 max-w-[1280px] w-full mx-auto my-0'>
            <div className='space-y-5'>
                <h2 className='text-5xl font-medium max-w-[570]'>Simplify collections and stay on top of every contribution.</h2>
                <p className='max-w-[550px] text-[#333333]'>Whether it’s for a group trip, wedding, dues, or project — Kolekto helps you collect money with less stress, better tracking, and full transparency.</p>

                <Button>
                    Get started - it’s free
                </Button>
            </div>
            <Image width={600} height={700} src={simColImage} alt='simplify collection' />
        </section>
    )
}

export default SimplifyCollection
