import { FaWhatsapp } from "react-icons/fa";

export default function WhatsAppButton() {
    return (
        <a
            href="https://wa.me/+2349019840377" // replace with your WhatsApp number
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-5 right-5 z-40 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center"
        >
            <FaWhatsapp className="text-3xl" />
        </a>
    );
}
