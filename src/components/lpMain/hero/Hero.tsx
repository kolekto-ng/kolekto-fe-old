import React, { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import avatar1 from "../../../assets/avatar-4.png";
import avatar2 from "../../../assets/avatar-2.png";
import avatar3 from "../../../assets/avatar-1.png";
import avatar4 from "../../../assets/avatar-3.png";
import paystack from "../../../assets/paystack.png";
import collectionSvg from "../../../assets/collector-svg.svg";
import IIH from "../../../assets/iih.png";
import heroImage from "../../../assets/hero-image.jpg";
import styles from "./hero.module.css";
import { Link } from "react-router-dom";
const Hero = () => {
  const logos = [
    { name: "Ilorin Innovation Hub", src: IIH },
    { name: "Paystack", src: paystack },
    { name: "Ilorin Innovation Hub", src: IIH },
    { name: "Paystack", src: paystack },
    { name: "Ilorin Innovation Hub", src: IIH },
    { name: "Paystack", src: paystack },
    { name: "Paystack", src: IIH },
    { name: "Paystack", src: paystack },
    { name: "Paystack", src: IIH },
    { name: "Paystack", src: paystack },
  ];

  return (
    <section className="bg-gray-50 min-h-screen flex flex-col justify-center items-center w-full">
      {/* Main Hero Content */}

      <div
        data-aos="fade-up"
        className="flex-1 px-4 lg:px-8 py-8 lg:py-12 max-w-[1280px] w-full mx-auto flex flex-col justify-center items-center"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center justify-center m-auto w-full">
          {/* Left Content */}

          <div className="order-1 lg:order-1 space-y-[23.2px] lg:space-y-8 ">
            {/* Badge */}

            <div className="font-clash inline-flex items-center space-x-5 text-[12.8px] lg:text-[20px] font-normal">
              <span>Power Your</span>
              <span className="flex items-center gap-2 bg-green-800 text-white px-3 py-1 rounded-md">
                <img
                  height={20}
                  width={20}
                  src={collectionSvg}
                  alt="collection"
                />
                Collection
              </span>
            </div>

            {/* Main Heading */}

            <div className="">
              <h1 className="text-[30.7px] sm:text-5xl lg:text-[64px] font-medium">
                Receive Group Payments with Ease
              </h1>
            </div>

            {/* Description */}

            <p className="text-[12.8px] lg:text-[18px] poppins text-[#333333] max-w-lg">
              From class dues to fundraising drives, Kolekto lets you collect, track, and manage contributions all in one place.
            </p>

            <div className="flex gap-3 flex-col sm:flex-row lg:items-center">
              {/* <Link to="/register">Get Started</Link> */}
              <Link
                to="/register"
                className=" bg-[#1C5C23] text-[12.8] w-max lg:text-[20px] text-white py-[11.5px] px-[12.8px] lg:px-4 lg:py-4 rounded-lg  font-semibold hover:bg-green-900 transition-colors duration-200 shadow-lg"
              >
                Start collecting
              </Link>

              <div className="flex items-center gap-2 text-[12.8px] lg:text-lg font-normal text-gray-600">
                <div className="flex -space-x-6">
                  <img
                    src={avatar1}
                    alt="user1"
                    width={40}
                    height={40}
                    className="w-[54px] h-[54px] rounded-full border-2 border-white"
                  />
                  <img
                    src={avatar2}
                    alt="user2"
                    width={40}
                    height={40}
                    className="w-[54px] h-[54px] rounded-full border-2 border-white"
                  />
                  <img
                    src={avatar3}
                    alt="user3"
                    width={40}
                    height={40}
                    className="w-[54px] h-[54px] rounded-full border-2 border-white"
                  />
                  <img
                    src={avatar4}
                    alt="user4"
                    width={40}
                    height={40}
                    className="w-[54px] h-[54px] rounded-full border-2 border-white"
                  />
                </div>
                {/* Trust Test */}
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Trusted By 700+ Users
                  </p>
                  <div className="flex items-center space-x-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-normal text-gray-600">
                      4.95 (478 reviews)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Hero Image */}

          <div
            data-aos="fade-up"
            className="relative order-2 lg:order-2 items-center ml-auto"
          >
            <div className="relative">
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={heroImage}
                  alt="hero-image"
                  width={450}
                  height={560}
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* logo strip */}
      <div className="bg-white w-full min-[300px]: overflow-hidden border-t border-gray-100 py-8 mt-9">
        <div className={`${styles.marqueeWrapper} px-4 sm:px-6 lg:px-8`}>
          <div className={`${styles.marqueeContent}`}>
            {/* original items */}
            {logos.map((logo, i) => (
              <React.Fragment key={i}>
                <div className={`${styles.marqueeItem}`}>
                  <img
                    src={logo.src}
                    alt="Paystack-logo"
                    width={100}
                    height={100}
                    className="w-[10ox] object-cover"
                  />
                </div>

                {/* Add more logos here if needed */}
              </React.Fragment>
            ))}
            <div className={`${styles.marqueeItem}`}>
              <img
                src={IIH}
                alt="Paystack-logo"
                width={100}
                height={100}
                className="w-[10ox] object-cover"
              />
            </div>
            <div className={`${styles.marqueeItem}`}>
              <img
                src={paystack}
                alt="Paystack-logo"
                width={100}
                height={100}
                className="w-[10ox] object-cover"
              />
            </div>
            <div className={`${styles.marqueeItem}`}>
              <img
                src={IIH}
                alt="Paystack-logo"
                width={100}
                height={100}
                className="w-[10ox] object-cover"
              />
            </div>
            <div className={`${styles.marqueeItem}`}>
              <img
                src={paystack}
                alt="Paystack-logo"
                width={100}
                height={100}
                className="w-[10ox] object-cover"
              />
            </div>
            <div className={`${styles.marqueeItem}`}>
              <img
                src={IIH}
                alt="Paystack-logo"
                width={100}
                height={100}
                className="w-[10ox] object-cover"
              />
            </div>
            <div className={`${styles.marqueeItem}`}>
              <img
                src={paystack}
                alt="Paystack-logo"
                width={100}
                height={100}
                className="w-[10ox] object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
