'use client'
import Image from 'next/image'
import React, { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'


const Header = () => {

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen)
    };

    const navigation = [
        { name: 'How it Works', href: '/how-it-works' },
        { name: 'Use Cases', href: '/use-cases' },
        { name: 'FAQs', href: '/faqs' },
        { name: 'Why Kolekto?', href: '/why-kolekto' },
    ];


    return (
        <header className={'shadow-sm border-b border-[#E0E0E0]'}>
            <nav className='px-1 sm:px-4 lg:px-6 max-w-[1280px] w-full mx-auto my-0'>
                <div className='flex justify-between items-center h-16'>

                    {/* Logo */}

                    <div className='flex'>
                        <Link href='/' className=''>
                            <Image
                                width={120}
                                height={120}
                                src='/kolekto-lp-logo.png'
                                alt='kolekto logo'
                                className='w-auto'
                                priority
                            />
                        </Link>
                    </div>

                    {/* Desktop Navigation */}

                    <div className='hidden md:flex items-center space-x-8'>
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className='text-black hover:text-gray-900 text-lg font-normal transition-colors duration-200'
                            >
                                {item.name}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop Auth Buttons */}

                    <div className='hidden lg:flex items-center space-x-3 pr-2'>
                        <Link
                            href='/sign-in'
                            className='border-2 text-[#1C5C23] border-[#1C5C23] px-3 py-1 rounded-md hover:text-[#1c5c23b2] text-[20px] font-semibold transition-colors duration-200'
                        >
                            Sign In
                        </Link>
                        <Link
                            href='/sign-up'
                            className='bg-green-800 text-white px-4 py-2 rounded-md text-[20px] font-semibold hover:bg-green-700 transition-colors duration-200'
                        >
                            Sign Up
                        </Link>
                    </div>

                    {/* Mobile Menu Buttons */}

                    <div className='lg:hidden flex items-center pr-2'>
                        <button
                            onClick={toggleMenu}
                            className='inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500'
                            aria-expanded='false'
                        >
                            <span className='sr-only'>
                                Open Main Menu
                            </span>
                            {isMenuOpen ? (
                                <X className='block h-6 w-6' aria-hidden='true' />
                            ) : (
                                <Menu className='block h-6 w-6 ' aria-hidden='true' />
                            )}
                        </button>
                    </div>

                    {/* Mobile Menu Buttons */}

                    {isMenuOpen && (
                        <div className='lg:hidden absolute top-16 left-0 right-0 z-50'>
                            <div className='bg-white shadow-lg'>
                                <div className='py-4'>
                                    {navigation.map((item) => (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className='text-gray-700 hover:text-green-500 block text-center px-6 py-3 rounded-md text-base font-bold transition-colors duration-200'
                                            onClick={() => setIsMenuOpen()}
                                        >
                                            {item.name}
                                        </Link>
                                    ))}

                                    {/* Clean Seperator Line */}

                                    <div className='border-t border-gray-100 my-3 mx-6'></div>

                                    {/* Mobile Auth Buttons */}

                                    <div className='px-6 space-y-3 flex flex-col items-center'>
                                        <Link
                                            href='/sign up'
                                            className='bg-green-900 text-white w-full max-w-s text-center px-4 py-3 rounded-md text-base font-medium hover:bg-green-700 transition-colors duration-200'
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            Sign Up
                                        </Link>
                                        <Link
                                            href='/sign in'
                                            className='border-1 border-green-700 text-green-900 hover:text-green-800 w-full max-w-s text-center px-4 py-2 rounded-md text-base font-medium transition-colors duration-200'
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            Sign In
                                        </Link>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </nav>
        </header>
    )
}

export default Header
