import React from 'react'
import Link from 'next/link'
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import '../lpMain/hwWorks/works.css'


const Footer = () => {
  return (
    <footer className={`w-full bg-green-800 text-white py-12 md:py-16 px-4 md:px-8 poppins`}>
      <div className={`overflow-x-hidden max-w-[1280px] w-full mx-auto my-0`}>
        {/* Main Footer Content */}
        <div className='grid grid-cols-2 lg:grid-cols-5 gap-8 mb-8'>
          {/* Stay Connected Section */}
          <div className='col-span-2 lg:col-span-1'>
            <h3 className='text-2xl font-bold mb-6'> Stay Connected </h3>
            <div className='flex space-x-4'>
              <Link href='/social/facebook' className='p-2  bg-opacity-20 rounded-full hover:bg-opacity-30 transistion-colors'>
                <Facebook className='w-5 h-5 ' />
              </Link>
              <Link href='/social/twitter' className='p-2  bg-opacity-20 rounded-full hover:bg-opacity-30 transistion-colors'>
                <Twitter className='w-5 h-5 ' />
              </Link>
              <Link href='/social/linkedin' className='p-2  bg-opacity-20 rounded-full hover:bg-opacity-30 transistion-colors'>
                <Linkedin className='w-5 h-5 ' />
              </Link>
              <Link href='/social/Instagram' className='p-2 bg-red-white bg-opacity-20 rounded-full hover:bg-opacity-30 transistion-colors'>
                <Instagram className='w-5 h-5 ' />
              </Link>
            </div>
            <p className='text-xs mt-4 text-yellow-500'> Kolekto, Inc. All Rights Reserved</p>
          </div>
          {/* Product Section */}
          <div className='lg:col-span-1'>
            <h4 className='text-base md:text-lg font-medium mb-4 md:mb-6 text-orange-400'> Product</h4>
            <ul className='space-y-2 md:space-y-3'>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Create Collection
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Wallet Overview
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Contribution Tiers
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Custom Bonding
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Real Time Tracking
                </Link>
              </li>

            </ul>
          </div>

          {/* Company Column */}

          <div className='lg:col-span-1'>
            <h4 className='text-base md:text-lg font-medium mb-4 md:mb-6 text-orange-400'>
              Comapny
            </h4>
            <ul className='space-y-2 md:space-y-3'>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  About
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Careers
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Contact
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Press
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Partnerships
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div className='lg:col-span-1'>
            <h4 className='text-base md:text-lg font-medium mb-4 md:mb-6 text-orange-400'>Resources</h4>
            <ul className='space-y-2 md:space-y-3'>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Help Center
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  FAQ
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Blog
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Guides
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Community Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Column 2 */}
          <div className='lg:col-span-1'>
            <h4 className='text-base md:text-lg font-medium mb-4 md:mb-6 text-orange-400'>Resources</h4>
            <ul className='space-y-2 md:space-y-3'>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Tiered Contributions
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Withdrawals Request
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Collection Analytics
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  KYC & Access Controls
                </Link>
              </li>
              <li>
                <Link href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Admin Dashboard
                </Link>
              </li>
            </ul>
          </div>


        </div>
      </div>
    </footer>
  )
}

export default Footer
