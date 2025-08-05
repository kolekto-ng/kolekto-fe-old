"use client"
import Image from 'next/image'
import React, { useEffect, useRef } from 'react'
import contributeImage from '../../../assets/contribut.png'
import './works.css'


const steps = [
    {
        id: 1,
        title: "Choose the Contribution Type",
        desc: "Start by selecting the type of group payment you want to collect — Regular (fixed amount), Tiered pricing, or Donation-based.",
        img: contributeImage, // dummy path
    },
    { id: 2, title: "Customize Fundraiser", desc: "Add title, description, and branding.", img: contributeImage },
    { id: 3, title: "Invite Contributors", desc: "Share the link with friends or team.", img: contributeImage },
    { id: 4, title: "Track Progress", desc: "Monitor contributions in real-time.", img: contributeImage },
];


const HowItWorks = () => {

    // const scrollRef = useRef(null);

    // useEffect(() => {
    //     const scrollContainer = scrollRef.current;
    //     if (!scrollContainer) return;

    //     const scrollStep = 700; // Adjust based on card width
    //     const delay = 3000; // 3 seconds
    //     let currentScroll = 0;

    //     const scrollInterval = setInterval(() => {
    //         if (scrollContainer.scrollLeft + scrollContainer.offsetWidth >= scrollContainer.scrollWidth) {
    //             // Reset to beginning
    //             scrollContainer.scrollTo({ left: 0, behavior: "smooth" });
    //             currentScroll = 0;
    //         } else {
    //             // Scroll right by one card
    //             currentScroll += scrollStep;
    //             scrollContainer.scrollTo({ left: currentScroll, behavior: "smooth" });
    //         }
    //     }, delay);

    //     return () => clearInterval(scrollInterval);
    // }, []);

    return (
        <section className='marquee-wrapper [background:linear-gradient(135deg,_#6e8e30,_#2f6b2e,_#6e8e30)] bg-cover bg-center bg-no-repeat py-20 px-4 text-white'>
            <h2 className='font-semibold text-4xl text-center mb-10'>How it works</h2>

            <div
                className={`marquee-content flex gap-6 px-2 md:px-6`}
            >
                {steps.map((step) => (
                    <div
                        key={step.id}
                        className="marquee-item shrink-0 bg-[#f0f8e9] px-6 py-10 rounded-xl w-[90vw] max-w-[700px] text-left"
                    >
                        <div className="mb-6">
                            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#ccf17d] text-black font-bold text-lg">
                                {step.id}
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold mt-4 text-black">
                                {step.title}
                            </h3>
                            <p className="text-gray-700 mt-2">{step.desc}</p>
                        </div>

                        <div className="bg-[#D4F8AB] flex justify-center items-center rounded-lg pt-4">
                            <Image
                                width={400}
                                height={300}
                                src={step.img}
                                alt="contribute"
                                className="object-contain"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default HowItWorks;
