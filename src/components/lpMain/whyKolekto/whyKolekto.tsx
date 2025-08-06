import Button from '@/components/Button'
import React from 'react'
import '../hwWorks/works.module.css'
import { Link } from 'react-router-dom'

const whyKolekto = () => {
    return (
        <section className='flex justify-between flex-col lg:flex-row items-center px-4 py-12 lg:px-8 lg:py-12 gap-10 max-w-[1280px] w-full mx-auto my-0'>
            <div className='max-w-[490px] space-y-4'>
                <h2 className='text-[28px] lg:text-5xl font-medium'>Why choose Kolekto?</h2>
                <p className='text-[14px] poppins text-[#333333]'>Managing group contributions shouldn't be stressful. With Kolekto, you can create, share, and track collections effortlessly  whether it's for an event, community goal, or personal project. Our platform makes it simple, secure, and organized  so everyone stays on the same page.</p>
                <Link to="/register" className='poppins inline-block bg-[#1C5C23] text-[12.8] w-max lg:text-[20px] text-white py-[11.5px] px-[12.8px] lg:px-4 lg:py-4 rounded-lg  font-semibold hover:bg-green-900 transition-colors duration-200'>Get started - it’s free</Link>
            </div>

            <div className='grid grid-cols-2 gap-8'>
                <div>
                    <h3 className='text-2xl font-medium mb-2'>Save time and reduce stress</h3>
                    <p className='poppins text-[12px] lg:text-[16px] font-normal text-[#333333]'>No more chasing people for payments or keeping messy records. Kolekto helps you set up drives, automate tracking, and view everything in one place.</p>
                </div>

                <div>
                    <h3 className='text-2xl font-medium  mb-2'>Collect faster, your way</h3>
                    <p className='poppins text-[12px] lg:text-[16px] font-normal text-[#333333]'>Use flexible options like tiered payments (Regular, VIP, VVIP) to match your contributors. Everyone pays how they can  and you get full control.</p>
                </div>

                <div>
                    <h3 className='text-2xl font-medium  mb-2'> Customizable to fit any occasion</h3>
                    <p className='poppins text-[12px] lg:text-[16px] font-normal text-[#333333]'>From weddings to club dues or memorial donations  Kolekto adapts to whatever you’re planning. Add custom fields, banners, and branding.</p>
                </div>

                <div>
                    <h3 className='text-2xl font-medium  mb-2'>See where every naira goes</h3>
                    <p className='poppins text-[12px] lg:text-[16px] font-normal text-[#333333]'>Real-time wallets and transparent reporting help you track contributions, fees, and withdrawals  so nothing is hidden, and everything makes sense.</p>
                </div>

                <div>
                    <h3 className='text-2xl font-medium  mb-2'>Build trust with contributors</h3>
                    <p className='poppins text-[12px] lg:text-[16px] font-normal text-[#333333]'>Custom-branded receipts, contributor emails, and a professional interface make people feel confident about where their money is going.</p>
                </div>

                <div>
                    <h3 className='text-2xl font-medium  mb-2'>Stay in control, even with large groups</h3>
                    <p className='poppins text-[12px] lg:text-[16px] font-normal text-[#333333]'>Whether it’s 10 contributors or 1,000  Kolekto’s dashboard makes it easy to manage everyone without stress.</p>
                </div>
            </div>
        </section>
    )
}

export default whyKolekto
