import React, { useRef, useEffect, useState } from "react";
import { motion, useInView, useAnimation } from "framer-motion";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer/Footer";
import image from "../assets/kolekto-on-campus.png";
import collectionSvg from "../assets/collector-svg.svg";
import {
  ArrowRight,
  CheckCircle,
  Gift,
  Rocket,
  HeadsetIcon,
  Search,
  X,
} from "lucide-react";
import { axiosInstance } from "@/utils/axios";
import { toast } from "sonner";

export default function KolektoCampusSignup() {
  // Animation controls
  const controls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  // State for form
  const [selectedCampus, setSelectedCampus] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [nigerianUniversities, setNigerianUniversities] = useState<string[]>([]);
  const dropdownRef = useRef(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [controls, isInView]);

  // Fetch campuses from API and update state
  useEffect(() => {
    (async () => {
      try {
        const campuses = await axiosInstance.get('/landing-page/campuses');
        if (campuses?.data) {
          const campusList = campuses.data.map(campus => campus.campus_name + ' ' + campus.campus_code);
          // campusList.push("Other (Not Listed)");
          setNigerianUniversities(campusList);
        }
      } catch (error) {
        // Optionally handle error
        setNigerianUniversities(["Other (Not Listed)"]);
      }
    })();
  }, []);

  // when theis component mounts, scroll to the #form-section if its on the url hash
  useEffect(() => {
    if (window.location.hash === "#form-section") {
      const formSection = document.getElementById("form-section");
      if (formSection) {
        formSection.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, []);


  const handleCampusJoin = async (e) => {
    try {
      e.preventDefault();
      setFormLoading(true);
      setFormError(null);
      setFormSuccess(null);

      const formData = new FormData(e.target);
      const payload = {
        first_name: formData.get('first-name'),
        last_name: formData.get('lastname'),
        email: formData.get('email'),
        phone_number: formData.get('whatsapp'),
        campus: selectedCampus,
      };

      const res = await axiosInstance.post('/landing-page/join-campus', payload);
      console.log(selectedCampus)
      if (res.data) {
        if (selectedCampus != "Other (Not Listed)") {
          setFormSuccess(`Thank you for joining the ${selectedCampus} campus community!`);
          toast.success(`Thank you for joining the ${selectedCampus} campus community!`);
        } else {
          setFormSuccess("Thank you for joining the Kolekto Campus community!");
          toast.success("Thank you for joining the Kolekto Campus community!");
        }
        e.target.reset();
        setSelectedCampus("");
        setSearchTerm("");
        setShowOtherInput(false);
      } else {
        setFormError("Something went wrong. Please try again.");
        toast.error("Something went wrong. Please try again.");
      }
    } catch (error: any) {
      setFormError(error?.response?.data?.message || "Network error. Please try again.");
      toast.error(error?.response?.data?.message || "Network error. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  // Handle campus selection change
  const handleCampusChange = (university) => {
    setSelectedCampus(university);
    setSearchTerm(university);
    setIsDropdownOpen(false);
    setShowOtherInput(university === "Other (Not Listed)");
  };

  // Filter universities based on search term
  const filteredUniversities = nigerianUniversities.filter((university) =>
    university.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Clear search and close dropdown
  const clearSearch = () => {
    setSearchTerm("");
    setSelectedCampus("");
    setIsDropdownOpen(true);
  };

  // Framer Motion variants
  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  const staggerChildren = {
    visible: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-neutral-50 font-sans text-neutral-800 overflow-x-hidden">
      <NavBar />

      {/* Account Notice Banner */}
      <div className="w-full bg-amber-50 border-b border-amber-200 py-3 px-4">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 text-sm">
          <span className="text-amber-800 font-medium">
            Don't have a Kolekto account yet?
          </span>
          <a
            href="/register"
            className="text-green-800 font-bold hover:underline flex items-center"
          >
            Sign up first to get started
            <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </div>
      </div>

      {/* MAIN */}
      <main className="flex-1">
        {/* HERO */}
        <section className="relative py-16 sm:py-24 overflow-hidden" id="hero">
          {/* Animated background elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <motion.div
              className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-emerald-100 opacity-50"
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 10, 0],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute top-1/3 -right-16 w-40 h-40 rounded-full bg-amber-100 opacity-40"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, -15, 0],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
            />
            <motion.div
              className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-green-800 opacity-30"
              animate={{
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }}
            />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <motion.div
                className="text-center lg:text-left"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7 }}
              >
                <motion.div
                  className="inline-flex items-center space-x-3 text-sm lg:text-base font-medium mb-5 bg-white rounded-full py-1.5 px-4 shadow-sm border border-emerald-100"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span>Power Your</span>
                  <span className="flex items-center gap-2 bg-green-800 text-white px-3 py-1 rounded-full">
                    <img
                      height={16}
                      width={16}
                      src={collectionSvg}
                      alt="collection"
                      className="text-white"
                    />
                    Collection
                  </span>
                </motion.div>

                <motion.h1
                  className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl md:text-5xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Be Among the First to Use{" "}
                  <span className="text-green-800">Kolekto</span> on Your Campus
                </motion.h1>

                <motion.p
                  className="mt-6 text-lg text-amber-600 font-medium"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  Join the Kolekto Campus Community and unlock exclusive
                  benefits just for students.
                </motion.p>

                <motion.div
                  className="mt-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <motion.a
                    className="inline-flex items-center rounded-full bg-green-800 text-white px-8 py-4 text-base font-bold shadow-lg hover:bg-green-950 transition-colors"
                    href="#form-section"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Sign Up for Kolekto Campus
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </motion.a>
                </motion.div>
              </motion.div>

              <motion.div
                className="flex justify-center"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
              >
                <div className="relative">
                  <motion.div
                    className="absolute -inset-4 bg-green-800 rounded-2xl -z-10"
                    animate={{
                      rotate: [0, 3, 0],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <motion.img
                    src={image}
                    alt="Students using Kolekto app"
                    className="max-w-md w-full rounded-2xl shadow-xl"
                    whileHover={{
                      scale: 1.02,
                      transition: { duration: 0.3 },
                    }}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* WHY JOIN */}
        <section className="py-16 sm:py-24 bg-white" id="why-join">
          <div className="container mx-auto px-6">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                Why Join Kolekto Campus?
              </h2>
              <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">
                Exclusive benefits designed specifically for students to make
                group payments easier and more rewarding.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
              variants={staggerChildren}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              ref={ref}
            >
              {[
                {
                  icon: <HeadsetIcon className="h-8 w-8" />,
                  title: "Priority Support",
                  desc: "Get dedicated support to help you with any questions or issues.",
                  color: "emerald",
                  gradient: false,
                },
                {
                  icon: <Gift className="h-8 w-8" />,
                  title: "Campus Perks",
                  desc: "Unlock exclusive rewards and offers tailored for students on campus.",
                  color: "amber",
                  gradient: false,
                },
                {
                  icon: <Rocket className="h-8 w-8" />,
                  title: "Early Access",
                  desc: "Be the first to experience new features and updates before they're released.",
                  color: "emerald",
                  gradient: true,
                },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeIn}
                  className="group relative overflow-hidden rounded-2xl bg-white p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full bg-green-800 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />

                  <motion.div
                    className={`relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${item.gradient
                      ? "bg-gradient-to-r from-emerald-600 to-amber-300 text-white"
                      : `bg-${item.color}-100 text-${item.color}-600`
                      } mb-6 group-hover:scale-110 transition-transform duration-300`}
                    whileHover={{ rotate: 5 }}
                  >
                    {item.icon}
                  </motion.div>

                  <h3 className="relative z-10 mt-6 text-xl font-bold text-neutral-900">
                    {item.title}
                  </h3>
                  <p className="relative z-10 mt-3 text-neutral-600">
                    {item.desc}
                  </p>

                  <motion.div
                    className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-800 to-amber-200 origin-left"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 + idx * 0.1 }}
                    viewport={{ once: true }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* FORM SECTION */}
        <section
          className="py-16 sm:py-24 bg-gradient-to-br from-green-700 to-green-900"
          id="form-section"
        >
          <div className="container mx-auto max-w-2xl px-6">
            <motion.div
              className="bg-white rounded-3xl p-8 sm:p-12 shadow-2xl border border-green-800/20"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-neutral-900">
                  Join Your Campus Community
                </h2>
                <p className="mt-3 text-neutral-600">
                  Sign up now to get exclusive access and benefits
                </p>
              </div>

              {/* Show loading, error, or success states */}
              {/* {formLoading && (
                <div className="mb-4 flex items-center justify-center text-emerald-700">
                  <Rocket className="animate-spin h-5 w-5 mr-2" />
                  Submitting your details...
                </div>
              )}
              {formError && (
                <div className="mb-4 text-red-600 font-medium text-center">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="mb-4 text-green-700 font-medium text-center">
                  {formSuccess}
                </div>
              )} */}

              <form className="space-y-6" onSubmit={handleCampusJoin}>
                {[
                  {
                    id: "first-name",
                    label: "First name *",
                    type: "text",
                    placeholder: "Enter your first name",
                  },
                  {
                    id: "lastname",
                    label: "Last name *",
                    type: "text",
                    placeholder: "Enter your last name",
                  },
                  {
                    id: "email",
                    label: "Email (same as Kolekto sign-up) *",
                    type: "email",
                    placeholder: "Enter your email",
                  },
                  {
                    id: "whatsapp",
                    label: "WhatsApp number *",
                    type: "tel",
                    placeholder: "Enter your WhatsApp number",
                  },
                ].map((field, idx) => (
                  <motion.div
                    key={field.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    viewport={{ once: true }}
                  >
                    <label
                      className="block text-sm font-medium text-neutral-700 mb-2"
                      htmlFor={field.id}
                    >
                      {field.label}
                    </label>
                    <div className="mt-1">
                      <input
                        className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-14 px-5 border transition-colors hover:border-emerald-300"
                        id={field.id}
                        name={field.id}
                        placeholder={field.placeholder}
                        type={field.type}
                        required
                      />
                    </div>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  viewport={{ once: true }}
                >
                  <label
                    className="block text-sm font-medium text-neutral-700 mb-2"
                    htmlFor="campus-search"
                  >
                    Campus *
                  </label>
                  <div className="mt-1 space-y-2 relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search for your campus..."
                        className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-14 pl-10 pr-10 border transition-colors hover:border-emerald-300"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        required
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={clearSearch}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-xl bg-white border border-gray-200 shadow-lg"
                      >
                        <div className="py-1">
                          {filteredUniversities.length > 0 ? (
                            filteredUniversities.map((university, index) => (
                              <button
                                key={index}
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors"
                                onClick={() => handleCampusChange(university)}
                              >
                                {university}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-gray-500">
                              No universities found. Try a different search or choose others
                              term.
                              <button
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors"
                                onClick={() => handleCampusChange("Other (Not Listed)")}
                              >
                                Other (Not Listed)
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {showOtherInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.3 }}
                        className="mt-2"
                      >
                        <input
                          type="text"
                          placeholder="Please specify your campus"
                          className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-14 px-4 border transition-colors hover:border-emerald-300"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  viewport={{ once: true }}
                >
                  <motion.button
                    className={`w-full flex justify-center items-center rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-800 px-8 py-4 text-lg font-bold text-white shadow-lg hover:shadow-xl transition-all hover:from-emerald-700 hover:to-emerald-900 ${formLoading ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={formLoading}
                  >
                    {formLoading ? "Joining..." : "Join Now"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </motion.button>
                </motion.div>
                {formLoading && (
                  <div className="mb-4 flex items-center justify-center text-emerald-700">
                    <Rocket className="animate-spin h-5 w-5 mr-2" />
                    Submitting your details...
                  </div>
                )}
                {formError && (
                  <div className="mb-4 text-red-600 font-medium text-center">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="mb-4 text-green-700 font-medium text-center">
                    {formSuccess}
                  </div>
                )}

                <p>Dont' have an account? Please <a className="text-green-600 text-[18px] font-semibold" href="/register">sign up</a> </p>
              </form>
            </motion.div>
          </div>
        </section>

        {/* INCENTIVES */}
        <section className="py-16" id="incentives-banner">
          <div className="container mx-auto px-6">
            <motion.div
              className="relative rounded-3xl bg-gradient-to-br from-green-700 to-green-900 p-8 sm:p-12 text-center text-white overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              {/* Animated background elements */}
              <div className="absolute inset-0 overflow-hidden">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full bg-white opacity-10"
                    style={{
                      width: Math.random() * 100 + 50,
                      height: Math.random() * 100 + 50,
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`,
                    }}
                    animate={{
                      scale: [0, 1.5, 0],
                      opacity: [0, 0.1, 0],
                    }}
                    transition={{
                      duration: Math.random() * 5 + 5,
                      repeat: Infinity,
                      delay: Math.random() * 2,
                    }}
                  />
                ))}
              </div>

              <div className="relative z-10 ">
                <h2 className="text-2xl sm:text-3xl font-bold">
                  Join our exclusive support group and{" "}
                  <span className="text-amber-300">earn perks</span> as you grow
                  with Kolekto.
                </h2>

                <motion.div
                  className="mt-8 inline-flex flex-wrap justify-center gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  viewport={{ once: true }}
                >
                  {[
                    "Early access to new features",
                    "Exclusive campus events",
                    "Priority customer support",
                    "Special rewards program",
                  ].map((benefit, idx) => (
                    <motion.div
                      key={idx}
                      className="flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2"
                      whileHover={{ scale: 1.05 }}
                    >
                      <CheckCircle className="h-5 w-5 mr-2 text-amber-300" />
                      <span>{benefit}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
