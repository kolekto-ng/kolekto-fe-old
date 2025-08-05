import React, { useEffect, useRef } from 'react';
import contributeImage from '../../../assets/contribut.png';
import styles from './works.module.css';

const steps = [
    {
        id: 1,
        title: "Choose the Contribution Type",
        desc: "Start by selecting the type of group payment you want to collect — Regular (fixed amount), Tiered pricing, or Donation-based.",
        img: contributeImage,
    },
    {
        id: 2,
        title: "Add the Details",
        desc: "Enter a title, description, amount(s), and any custom fields like name, matric number, phone number, etc. You’re in full control of the setup.",
        img: contributeImage,
    },
    {
        id: 3,
        title: "Share with Your Community",
        desc: "Once your collection is ready, you’ll get a unique link or QR code. Share it easily via WhatsApp, X (Twitter), Instagram, or email. Contributors can pay instantly—no sign-up required.",
        img: contributeImage,
    },
    {
        id: 4,
        title: "Track Funds in Real-Time",
        desc: "Monitor every payment as it comes in. See who contributed, how much has been raised, and what’s available—all from your live dashboard.",
        img: contributeImage,
    },
    {
        id: 5,
        title: "Withdraw Safely",
        desc: "Withdraw funds anytime with clear, transparent breakdowns. Kolekto uses Paystack’s trusted payment infrastructure to keep every transaction secure.",
        img: contributeImage,
    },
];

const HowItWorks = () => {
    const marqueeRef = useRef(null);

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

    return (
        <section className={`${styles.marquee} [background:linear-gradient(135deg,#6e8e30,#2f6b2e,#6e8e30)] py-2 px-4 text-white`}>
            <h2 className="font-semibold text-4xl text-center mb-10">How it works</h2>

            <div className={`${styles.marqueeContent} flex gap-6 px-2 md:px-6`} ref={marqueeRef}>
                {steps.map((step) => (
                    <div
                        key={step.id}
                        className="inline-block bg-[#f0f8e9] px-6 py-4 space-y-4 rounded-xl min-w-[400px] w-full max-w-[700px] text-left"
                    >
                        <div>
                            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#ccf17d] text-black font-bold text-lg">
                                {step.id}
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold mt-4 text-black">{step.title}</h3>
                            <p className="text-gray-700 mt-2">{step.desc}</p>
                        </div>

                        <div className="bg-[#D4F8AB] flex justify-center items-center rounded-lg pt-4">
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
