import React from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart2, CheckCircle2, Users, Wallet } from "lucide-react";
import RegisterForm from "@/components/auth/RegisterForm";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

const valueProps = [
  { icon: BarChart2, text: "Create any type of payment collection" },
  { icon: Users, text: "Track contributors in real time" },
  { icon: Wallet, text: "Withdraw earnings directly to your bank" },
];

const RegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const shouldResumePublish = searchParams.get("publish") === "1";
  const resolvedRedirectTo =
    redirectTo === "/create-collection" && shouldResumePublish
      ? "/create-collection?resumePublish=1"
      : redirectTo;

  useAuthRedirect({ redirectIfAuthenticated: true, redirectTo: resolvedRedirectTo });

  const isCollectionFlow = redirectTo === "/create-collection";

  return (
    <AuthPageShell
      variant="register"
      title={
        <>
          Create your <span className="text-kolekto">account</span>
        </>
      }
      subtitle={
        isCollectionFlow
          ? "Create an account to publish your saved collection"
          : "Join Kolekto and start collecting payments in minutes."
      }
      desktopTitle={
        <>
          Start collecting
          <br />
          payments today.
        </>
      }
      desktopSubtitle="Join organisers who use Kolekto to manage group payments with less stress and better visibility."
      valueProps={valueProps}
      contextBanner={
        isCollectionFlow ? (
          <motion.div
            className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.12 }}
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">
              Your collection is saved. Create a free account to publish it.
            </p>
          </motion.div>
        ) : null
      }
      footerNote="Free to join. No setup fees. Instant payouts."
    >
      <RegisterForm redirectTo={redirectTo} />
    </AuthPageShell>
  );
};

export default RegisterPage;
