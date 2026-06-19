import React from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Users, Zap } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

const valueProps = [
  { icon: Users, text: "Collect group payments in minutes" },
  { icon: ShieldCheck, text: "Secure, verified transactions every time" },
  { icon: Zap, text: "Instant receipts and live dashboards" },
];

const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const shouldResumePublish = searchParams.get("publish") === "1";
  const resolvedRedirectTo =
    redirectTo === "/create-collection" && shouldResumePublish
      ? "/create-collection?resumePublish=1"
      : redirectTo;
  const prefillEmail = searchParams.get("email") || "";

  useAuthRedirect({ redirectIfAuthenticated: true, redirectTo: resolvedRedirectTo });

  const isCollectionFlow = redirectTo === "/create-collection";

  return (
    <AuthPageShell
      variant="login"
      title={
        <>
          Welcome <span className="text-kolekto">back</span>
        </>
      }
      subtitle={
        isCollectionFlow
          ? "Sign in to publish your saved collection"
          : "Sign in to your Kolekto account to continue"
      }
      desktopTitle={
        <>
          Group payments,
          <br />
          made effortless.
        </>
      }
      desktopSubtitle="Create collections, track contributions, and get paid from one clean dashboard."
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
              Your collection is saved. Sign in to publish it and start collecting payments.
            </p>
          </motion.div>
        ) : null
      }
      footerNote="Secure. Fast & Reliable"
    >
      <LoginForm redirectTo={redirectTo} prefillEmail={prefillEmail} />
    </AuthPageShell>
  );
};

export default LoginPage;
