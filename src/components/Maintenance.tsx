import { useParams, useNavigate, Link } from 'react-router-dom';

import React from 'react'
import { FaTwitter, FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa";
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';


const Maintenance = () => {
    return (
        <div className='flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-800'>
            <nav className="w-full bg-white shadow-md fixed top-0 left-0 z-50">
                <div className="container px-4 py-3 flex justify-between items-center">
                    <div className=" container flex justify-between items-center space-x-4">
                        <Link to="/" className="flex items-center">
                            <Logo size="md" />
                        </Link>
                        <div className="flex items-center space-x-3">
                            <a
                                href="https://x.com/kolektng"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Twitter"
                            >
                                <FaTwitter className="text-gray-600 hover:text-kolekto text-xl" />
                            </a>
                            <a
                                href="https://www.facebook.com/share/1AVyxK7Prc/?mibextid=wwXIfr"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Facebook"
                            >
                                <FaFacebook className="text-gray-600 hover:text-kolekto text-xl" />
                            </a>
                            <a
                                href="https://www.instagram.com/kolekto.ng"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Instagram"
                            >
                                <FaInstagram className="text-gray-600 hover:text-kolekto text-xl" />
                            </a>
                            <a
                                href="https://wa.me/+2349019840377"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="WhatsApp"
                            >
                                <FaWhatsapp className="text-gray-600 hover:text-kolekto text-xl" />
                            </a>
                        </div>
                    </div>
                </div>
            </nav>

            <h1>Maintenance Mode</h1>
            <p>We are currently undergoing maintenance. Please check back later.</p>

            {/* <hr className='bg-red-300 border border-yellow-700' /> */}
            <div className="mt-12 text-center">
                <h2 className="text-2xl font-bold mb-4">
                    Ready to Start Collecting?
                </h2>
                <p className="text-gray-600 mb-6">
                    Join thousands of organizers across Africa who use Kolekto to
                    simplify group payments.
                </p>

                <Button>
                    <Link to="/register">Create Your Account</Link>
                </Button>
            </div>
        </div>
    )
}

export default Maintenance