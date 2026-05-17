import React, { useEffect, useRef, useState } from 'react';
import contributeImage from '../../../assets/contribut.png';
import img2 from '../../../assets/im2.png';
import img3 from '../../../assets/img3.png';
import img4 from '../../../assets/img4.png';
import img5 from '../../../assets/img5.png';
import styles from './works.module.css';

const steps = [
    {
        id: 1,
        title: "Choose the Contribution Type",
        desc: "Start by selecting the type of group payment you want to collect — Regular (fixed amount), Tiered pricing, or Donation-based.",
        color: "#D4F8AB",
        backgroundColor: "#F1F8E9",
        img: contributeImage,
    },
    {
        id: 2,
        title: "Add the Details",
        desc: "Enter a title, description, amount(s), and any custom fields like name, matric number, phone number, etc. You’re in full control of the setup.",
        color: "#A7F2EE",
        backgroundColor: "#E0F2F1",
        img: img2,
    },
    {
        id: 3,
        title: "Share with Your Community",
        desc: "Once your collection is ready, you’ll get a unique link or QR code. Share it easily via WhatsApp, X (Twitter), Instagram, or email. Contributors can pay instantly—no sign-up required.",
        color: "#FFEDB0",
        backgroundColor: "#FFF8E1",
        img: img3,
    },
    {
        id: 4,
        title: "Track Funds in Real-Time",
        desc: "Monitor every payment as it comes in. See who contributed, how much has been raised, and what’s available—all from your live dashboard.",
        color: "#AAB8F6",
        backgroundColor: "#D4DCFF",
        img: img4,
    },
    {
        id: 5,
        title: "Withdraw Safely",
        desc: "Withdraw funds anytime with clear, transparent breakdowns. Kolekto uses Paystack’s trusted payment infrastructure to keep every transaction secure.",
        color: "#A7F2EE",
        backgroundColor: "#E0F2F1",
        img: img5,
    },
];

const HowItWorks = () => {
    const marqueeRef = useRef(null);
    const [isPaused, setIsPaused] = useState();

    useEffect(() => {
        const root = document.documentElement;
        const marquee = marqueeRef.current;

        if (!marquee) return;

        const count = steps.length;
        root.style.setProperty("--marquee-elements", count.toString());

        const childrenArray = Array.from(marquee.children).slice(0, count);
        childrenArray.forEach((child) => {
            const clone = child.cloneNode(true);
            marquee.appendChild(clone);
        });
    }, []);

    const togglePause = () => {
        setIsPaused((prev) => !prev);
    };

    console.log(isPaused, "pase");


    return (
        <section data-aos="zoom-in" className={`${styles.marquee} [background:linear-gradient(135deg,#6e8e30,#2f6b2e,#6e8e30)] py-2 px-4 text-white`}>
            <h2 className="font-semibold text-4xl text-center mt-4 mb-10">How it works</h2>

            <div
                className={`${styles.marqueeContent} ${isPaused ? styles.paused : ''} flex gap-6 px-2 md:px-6`}
                ref={marqueeRef}
                onClick={togglePause} // Tap to pause/resume
            >
                {steps.map((step) => (
                    <div
                        key={step.id}
                        style={{ backgroundColor: step.backgroundColor }}
                        className="flex flex-col justify-between items-start px-6 py-4 rounded-xl min-w-0 sm:min-w-[400px] w-full max-w-[700px] text-left"
                    >
                        <div>
                            <div style={{ backgroundColor: step.color }} className={`w-10 h-10 flex items-center justify-center rounded-full text-black font-bold text-lg`}>
                                {step.id}
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold mt-4 text-black">{step.title}</h3>
                            <p className="text-gray-700 mt-2">{step.desc}</p>
                        </div>

                        <div style={{ backgroundColor: step.color }} className={`flex mb-0 justify-center items-center rounded-lg pt-4`}>
                            <img
                                width={400}
                                height={300}
                                src={step.img}
                                alt="contribute"
                                className="object-contain flex-1"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default HowItWorks;
