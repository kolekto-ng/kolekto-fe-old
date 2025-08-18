"use client";
import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const FAQSection = () => {
  const [openQuestion, setOpenQuestion] = useState(0); //First Question open by Default....

  const faqs = [
    {
      question: "What is Kolekto?",
      answer:
        "Kolekto is a platform that simplifies group payments and contributions. Create a collection, add custom fields (e.g., names, matric numbers), share a link, and track payments in real-time with automated receipts perfect for class reps, churches, or community organizers. Powered by Paystack for secure transactions.",
    },
    {
      question: "How do I create a collection?",
      answer:
        'Sign up, click "Create Collection," add details like amount and custom fields, and generate a shareable link. Contributors pay via the link, input info, and get receipts instantly. Its 3-5 clicks and takes under 2 minutes try it free now!',
    },
    {
      question: "Do I need to create an account to pay?",
      answer:
        ' No, Contributors don"t need to create an account to make payments. They can contribute directly through the payment link you share with them',
    },
    {
      question: "Is Kolekto secure?",
      answer:
        "Absolutely, we partnered with Paystack to process all payments, ensuring encryption and compliance with Nigerian regulations. Your data is protected, and we don't store sensitive info.",
    },
    {
      question: "How Much does Kolekto charge?",
      answer:
        "Kolekto is free to use, with no setup costs! We charge a reasonable amount as low as 50 Naira per contributor, based on the transaction size. Premium features like brand labeling are coming soon, start your first collection free today!",
    },
    {
      question: "How do I know my payment is sucessful?",
      answer:
        'You"ll receive an immediate confirmation email once your payment is processed sucessfully. The collection organiser will also be notified of your contribution',
    },
  ];

  const toggleQuestion = (index) => {
    setOpenQuestion(openQuestion === index ? -1 : index);
  };

  return (
    <section className="bg-gray-50 py-4 lg:py-12 max-w-[1280px] w-full mx-auto my-0">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left Section - FAQ Questions */}

          <div className="space-y-4 order-2 lg:order-1">
            {faqs.map((faq, index) => (
              <div
                data-aos="flip-down"
                key={index}
                className="bg-white rounded-lg shadow-sm border border-gray-200"
              >
                <button
                  onClick={() => toggleQuestion(index)}
                  className="w-full flex px-6 py-4 text-left justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-lg font-medium text-gray-950 flex-1">
                    {faq.question}
                  </h3>
                  <div className="">
                    {openQuestion === index ? <ChevronUp /> : <ChevronDown />}
                  </div>
                </button>
                {/* Answer Content */}
                {openQuestion === index && (
                  <div className="px-6 pb-4">
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-gray-600 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right Content - Title and Description */}

          <div className="lg:pl-12 mt-15 order-1 lg:order-2">
            <div data-aos="fade-up-left" className="space-y-6">
              <h2 className="text-[28px] lg:text-5xl font-medium text-gray-950 leading-tight">
                Frequently Asked Question!
              </h2>
              <p>
                Got any questions? We've answered some of the most common things
                people ask before getting started with Kolekto. If you dont find
                what you're looking for feel free to reach out. Thanks{" "}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
