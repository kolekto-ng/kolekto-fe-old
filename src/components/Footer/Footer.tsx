import React from 'react'
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import '../lpMain/hwWorks/works.module.css'


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
              <a href='/social/facebook' className='p-2  bg-opacity-20 rounded-full hover:bg-opacity-30 transistion-colors'>
                <Facebook className='w-5 h-5 ' />
              </a>
              <a href='/social/twitter' className='p-2  bg-opacity-20 rounded-full hover:bg-opacity-30 transistion-colors'>
                <Twitter className='w-5 h-5 ' />
              </a>
              <a href='/social/aedin' className='p-2  bg-opacity-20 rounded-full hover:bg-opacity-30 transistion-colors'>
                <Linkedin className='w-5 h-5 ' />
              </a>
              <a href='/social/Instagram' className='p-2 bg-red-white bg-opacity-20 rounded-full hover:bg-opacity-30 transistion-colors'>
                <Instagram className='w-5 h-5 ' />
              </a>
            </div>
            <p className='text-xs mt-4 text-yellow-500'> Kolekto, Inc. All Rights Reserved</p>
          </div>
          {/* Product Section */}
          <div className='lg:col-span-1'>
            <h4 className='text-base md:text-lg font-medium mb-4 md:mb-6 text-orange-400'> Product</h4>
            <ul className='space-y-2 md:space-y-3'>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Create Collection
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Wallet Overview
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Contribution Tiers
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Custom Bonding
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Real Time Tracking
                </a>
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
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  About
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Careers
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Contact
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Press
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transition-colors text-sm'>
                  Partnerships
                </a>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div className='lg:col-span-1'>
            <h4 className='text-base md:text-lg font-medium mb-4 md:mb-6 text-orange-400'>Resources</h4>
            <ul className='space-y-2 md:space-y-3'>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Help Center
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  FAQ
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Blog
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Guides
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Community Support
                </a>
              </li>
            </ul>
          </div>

          {/* Resources Column 2 */}
          <div className='lg:col-span-1'>
            <h4 className='text-base md:text-lg font-medium mb-4 md:mb-6 text-orange-400'>Resources</h4>
            <ul className='space-y-2 md:space-y-3'>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Tiered Contributions
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Withdrawals Request
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Collection Analytics
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  KYC & Access Controls
                </a>
              </li>
              <li>
                <a href='#' className='text-shadow-fuchsia-200 hover:text-white transistion-colors text-sm'>
                  Admin Dashboard
                </a>
              </li>
            </ul>
          </div>


        </div>
      </div>
    </footer>
  )
}

export default Footer
