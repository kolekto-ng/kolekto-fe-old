import React from 'react'
import fearuresImage from '../../../assets/featuresImage.png'
import cm from '../../../assets/cm.png'
import fundraising from '../../../assets/fundraising.png'
import tired from '../../../assets/tired.png'
import labeling from '../../../assets/white-labeling.png'
import '../hwWorks/works.module.css'


const Features = () => {
    return (
        <section className='flex flex-col gap-7 px-4 py-12 lg:px-8 lg:py-20 max-w-[1280px] w-full mx-auto my-0'>
            <div className='flex md:flex-row justify-between items-center gap-6 flex-col-reverse'>
                <img data-aos="fade-left" height={600} width={600} src={fearuresImage} />

                <div className='max-w-3xl space-y-6'>
                    <h2 className='md:text-[20px] text-[12px] font-clash'><span className='bg-[#1C5C23] py-1 px-3 font-normal rounded-[12px] text-white mr-5'>POWERFUL</span> Collection Features</h2>
                    <h3 className='md:text-5xl text-[28px] font-medium font-clash'>Everything You Need to Manage Group Payments Fast and Transparent</h3>
                    <p className='font-normal poppins text-[14px] md:text-[20px] text-[#333333]'>Take control of your group payments with branded pages, flexible pricing, real-time tracking, and smooth withdrawals  all in one place, with zero stress.</p>
                </div>
            </div>
            <div className='flex gap-1 flex-col md:flex-row justify-between items-center'>
                <div className='flex flex-col gap-1 lg:gap-7'>
                    <img height={400} width={400} src={cm} alt='collection managementbimage' />
                    <h3 className='font-medium text-2xl'>Collection Management</h3>
                    <p className='text-[#333333]'>Whether it’s for a party, project, or dues set up your contribution drive with everything you need, fast and easy.</p>
                </div>
                <div className='flex flex-col gap-1'>
                    <img height={400} width={400} src={tired} alt='Tiered Contributions' />
                    <h3 className='font-medium text-2xl'>Tiered Contributions</h3>
                    <p className='text-[#333333]'>Give your contributors more control  add multiple tiers with different amounts and benefits, and watch your collections grow faster.</p>
                </div>
                <div className='flex flex-col gap-1'>
                    <img height={400} width={400} src={fundraising} alt='Fundraising' />
                    <h3 className='font-medium text-2xl'>Fundraising</h3>
                    <p className='text-[#333333]'>Empower your donors with flexible giving options. Offer multiple tiers with different amounts and perks to boost your fundraising success.</p>
                </div>
                <div className='flex flex-col gap-1'>
                    <img height={400} width={400} src={labeling} alt='White-Label Branding' />
                    <h3 className='font-medium text-2xl'>White-Label Branding</h3>
                    <p className='text-[#333333]'>Make your collections feel truly yours by adding your logo and brand name  it shows on receipts, forms, and emails sent to contributors.</p>
                </div>
            </div>
        </section>
    )
}

export default Features
