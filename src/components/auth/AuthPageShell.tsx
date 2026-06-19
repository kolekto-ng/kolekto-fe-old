import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Clock3,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserPlus,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";

type AuthPageShellProps = {
  variant: "login" | "register";
  title: React.ReactNode;
  subtitle: string;
  desktopTitle: React.ReactNode;
  desktopSubtitle: string;
  valueProps: Array<{ icon: LucideIcon; text: string }>;
  contextBanner?: React.ReactNode;
  footerNote?: string;
  children: React.ReactNode;
};

const AuthHeroVisual = ({ variant }: { variant: "login" | "register" }) => {
  if (variant === "register") {
    return (
      <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
        <div className="absolute inset-0 rounded-full bg-emerald-50" />
        <div className="absolute inset-5 flex items-center justify-center rounded-full border-4 border-emerald-200 text-emerald-600">
          <UserPlus className="h-12 w-12" />
        </div>
        <span className="absolute bottom-4 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/20">
          <UserPlus className="h-5 w-5" />
        </span>
        <Sparkles className="absolute -right-7 top-2 h-5 w-5 text-emerald-300" />
        <Sparkles className="absolute -left-5 bottom-5 h-4 w-4 text-emerald-300" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto h-40 w-48 sm:h-44 sm:w-56">
      <div className="absolute left-7 top-9 h-24 w-28 rounded-[1.5rem] bg-gradient-to-br from-emerald-400 to-kolekto shadow-2xl shadow-emerald-900/20" />
      <div className="absolute left-12 top-6 h-20 w-28 rounded-[1.25rem] bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-lg shadow-emerald-900/15" />
      <div className="absolute left-24 top-20 h-16 w-20 rotate-[-10deg] rounded-lg bg-white shadow-xl">
        <div className="mx-auto mt-4 h-1.5 w-11 rounded-full bg-slate-300" />
        <div className="mx-auto mt-2 h-1.5 w-9 rounded-full bg-slate-300" />
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-300" />
      </div>
      <span className="absolute right-7 top-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-kolekto-yellow to-amber-500 text-white shadow-lg shadow-amber-900/20">
        <Clock3 className="h-7 w-7" />
      </span>
      <span className="absolute left-2 bottom-7 flex h-10 w-10 items-center justify-center rounded-full bg-white text-kolekto shadow-lg">
        <WalletCards className="h-5 w-5" />
      </span>
      <span className="absolute right-0 bottom-9 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-lg">
        <ReceiptText className="h-5 w-5" />
      </span>
      <Sparkles className="absolute left-1 top-5 h-4 w-4 text-emerald-300" />
      <Sparkles className="absolute right-3 top-24 h-4 w-4 text-emerald-300" />
    </div>
  );
};

const AuthPageShell: React.FC<AuthPageShellProps> = ({
  variant,
  title,
  subtitle,
  desktopTitle,
  desktopSubtitle,
  valueProps,
  contextBanner,
  footerNote,
  children,
}) => {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[linear-gradient(135deg,#f7fbfa_0%,#ffffff_44%,#effaf4_100%)]">
      <div className="pointer-events-none absolute -left-24 top-0 h-48 w-80 -rotate-12 rounded-3xl border border-emerald-100/80 bg-emerald-50/50" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-56 w-96 rotate-12 rounded-3xl border border-emerald-100/80 bg-emerald-50/40" />

      <div className="relative z-10 flex min-h-dvh">
        <aside className="hidden w-[42%] min-w-[420px] flex-col justify-between bg-gradient-to-br from-kolekto via-emerald-700 to-emerald-500 p-10 text-white lg:flex">
          <Link to="/" className="inline-flex w-fit">
            <Logo size="lg" className="brightness-0 invert" />
          </Link>

          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AuthHeroVisual variant={variant} />
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold leading-tight">{desktopTitle}</h2>
              <p className="max-w-sm text-sm leading-7 text-emerald-50">
                {desktopSubtitle}
              </p>
            </div>
            <ul className="space-y-4">
              {valueProps.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-emerald-50">{text}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <p className="flex items-center gap-2 text-sm text-emerald-50">
            <ShieldCheck className="h-4 w-4" />
            Secure. Fast & Reliable
          </p>
        </aside>

        <main className="flex flex-1 flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 lg:px-10">
          <Link to="/" className="mx-auto mb-8 inline-flex lg:hidden">
            <Logo size="lg" />
          </Link>

          <motion.div
            className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="mb-7 text-center">
              <div className="mb-4 lg:hidden">
                <AuthHeroVisual variant={variant} />
              </div>
              <h1 className="text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
                {title}
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-base font-normal leading-7 text-slate-600">
                {subtitle}
              </p>
            </div>

            {contextBanner}

            <div className="rounded-[1.75rem] border border-slate-100 bg-white/95 p-5 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-8 lg:p-10">
              {children}
            </div>

            {footerNote && (
              <p className="mt-7 text-center text-sm font-medium text-slate-500">
                {footerNote}
              </p>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default AuthPageShell;
