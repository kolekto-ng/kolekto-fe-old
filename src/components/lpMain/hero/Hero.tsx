import React from 'react'
import { Link, Star } from 'lucide-react'
import avatar1 from '../../../assets/avatar1.png'
import avatar2 from '../../../assets/avatar2.png'
import avatar3 from '../../../assets/avatar3.png'
import avatar4 from '../../../assets/avatar4.png'
import paystack from '../../../assets/paystack.png'
import collectionSvg from '../../../assets/collector-svg.svg'
import IIH from '../../../assets/iih.png'
import heroImage from '../../../assets/hero-image.png'
import '../hwWorks/works.css'

const Hero = () => {

    const logos = [
        { name: 'Ilorin Innovation Hub', src: IIH },
        { name: 'Paystack', src: paystack },
        { name: 'Ilorin Innovation Hub', src: IIH },
        { name: 'Paystack', src: paystack },
        { name: 'Ilorin Innovation Hub', src: IIH },
        { name: 'Paystack', src: paystack },
        { name: 'Paystack', src: paystack },
        { name: 'Paystack', src: paystack },
        { name: 'Paystack', src: paystack },
        { name: 'Paystack', src: paystack },
    ];

    return (
        <section className='bg-gray-50 min-h-screen flex flex-col items-center'>

            {/* Main Hero Content */}

            <div className='flex-1 px-4 lg:px-8 py-8 lg:py-12 max-w-[1280px] w-full mx-auto my-0'>
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center'>

                    {/* Left Content */}

                    <div className='order-1 lg:order-1 space-y-8'>

                        {/* Badge */}

                        <div className='inline-flex items-center space-x-5 text-[20px] font-medium'>
                            <span>Power Your</span>
                            <span className='flex items-center gap-2 bg-green-800 text-white px-3 py-1 rounded-md'><img height={20} width={20} src={collectionSvg} alt='collection' />Collection</span>
                        </div>

                        {/* Main Heading */}

                        <div className='space-y-4'>
                            <h1 className='text-3xl sm:text-5xl lg:text-4xl font-medium leading-tight'>
                                Effortless Group Payment, All in One Place.
                            </h1>
                        </div>

                        {/* Description */}

                        <p className='text-lg poppins text-[#333333] font-serif leading-relaxed max-w-lg'>
                            Kolekto makes it easy to create, manage, and track group contributions from class dues and church donations to event payments and team collection.
                        </p>


                        <div className='flex gap-3 flex-col sm:flex-row lg:items-center'>
                            {/* <Link to="/register">Get Started</Link> */}
                            <button className='poppins bg-[#1C5C23] text-[20px] text-white px-4 py-4 rounded-lg  font-semibold hover:bg-green-900 transition-colors duration-200 shadow-lg'>
                                Start a Contribution
                            </button>


                            <div className='flex -space-x-6'>
                                <img
                                    src={avatar1}
                                    alt='user1'
                                    width={40}
                                    height={40}
                                    className='w-[54px] h-[54px] rounded-full border-2 border-white'
                                />
                                <img
                                    src={avatar2}
                                    alt='user2'
                                    width={40}
                                    height={40}
                                    className='w-[54px] h-[54px] rounded-full border-2 border-white'
                                />
                                <img
                                    src={avatar3}
                                    alt='user3'
                                    width={40}
                                    height={40}
                                    className='w-[54px] h-[54px] rounded-full border-2 border-white'
                                />
                                <img
                                    src={avatar4}
                                    alt='user4'
                                    width={40}
                                    height={40}
                                    className='w-[54px] h-[54px] rounded-full border-2 border-white'
                                />
                            </div>
                            {/* Trust Test */}
                            <div className='text-left'>
                                <p className='text-sm font-semibold text-gray-900 mb-1'>
                                    Trusted By 100+ Users
                                </p>
                                <div className='flex items-center space-x-2'>
                                    <div className='flex'>
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className='w-4 h-4 fill-yellow-400 text-yellow-400' />
                                        ))}
                                    </div>
                                    <span className='text-[11px] font-normal text-gray-600'>4.95 (218 reviews)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    { /* Right Content - Hero Image */}

                    <div className='relative order-2 lg:order-2 items-center ml-auto'>
                        <div className='relative'>
                            <div className='relative overflow-hidden rounded-2xl'>
                                <img
                                    src={heroImage}
                                    alt='hero-image'
                                    width={450}
                                    height={560}
                                    className='object-cover'

                                />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            { /* logo strip */}
            <div className='bg-white w-full min-[300px]: overflow-hidden border-t border-gray-100 py-8 mt-9'>
                <div className='marquee-wrapper px-4 sm:px-6 lg:px-8'>
                    <div className='marquee-content'>
                        {/* original items */}
                        {logos.map((logo, i) => (
                            <React.Fragment key={i}>

                                <div className='marquee-item'>
                                    <img src={logo.src} alt='Paystack-logo' width={120} height={40} className='h-8 sm:h-10 lg:h-12 w-auto object-contain' />
                                </div>
                                <div className='marquee-item'>
                                    <img src={logo.src} alt='Paystack-logo' width={120} height={40} className='h-8 sm:h-10 lg:h-12 w-auto object-contain' />
                                </div>
                                {/* Add more logos here if needed */}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

        </section>
    )
}

export default Hero
