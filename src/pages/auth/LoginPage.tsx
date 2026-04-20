import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import LoginForm from '@/components/auth/LoginForm';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import Logo from '@/components/Logo';
import { Users, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';

const valueProps = [
  { icon: Users, text: 'Collect group payments in minutes' },
  { icon: ShieldCheck, text: 'Secure, verified transactions every time' },
  { icon: Zap, text: 'Instant receipts and live dashboards' },
];

const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const shouldResumePublish = searchParams.get('publish') === '1';
  const resolvedRedirectTo =
    redirectTo === '/create-collection' && shouldResumePublish
      ? '/create-collection?resumePublish=1'
      : redirectTo;
  const prefillEmail = searchParams.get('email') || '';

  useAuthRedirect({ redirectIfAuthenticated: true, redirectTo: resolvedRedirectTo });

  const isCollectionFlow = redirectTo === '/create-collection';

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel (desktop only) ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between bg-gradient-to-br from-[#1B5E20] via-[#2E7D32] to-[#388E3C] p-10 relative overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/5 rounded-full" />
        <div className="absolute bottom-10 -right-16 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/4 w-40 h-40 bg-kolekto-yellow/10 rounded-full blur-2xl" />

        {/* logo */}
        <div className="relative z-10">
          <Link to="/">
            <Logo size="lg" className="brightness-0 invert" />
          </Link>
        </div>

        {/* value proposition */}
        <motion.div
          className="relative z-10 space-y-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="space-y-3">
            <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              Group payments,<br />made effortless.
            </h2>
            <p className="text-green-200 text-base leading-relaxed max-w-xs">
              Create collections, track contributions, and get paid — all in one place.
            </p>
          </div>

          <ul className="space-y-4">
            {valueProps.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white" />
                </span>
                <span className="text-green-100 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* bottom tagline */}
        <p className="relative z-10 text-green-300 text-xs">
          Trusted by thousands of organisers across Nigeria
        </p>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        {/* mobile logo */}
        <div className="lg:hidden flex items-center justify-between px-6 pt-6 pb-2">
          <Link to="/">
            <Logo size="md" />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-10">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            {/* heading */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-gray-500 mt-1 text-sm">
                {isCollectionFlow
                  ? 'Sign in to publish your saved collection'
                  : 'Sign in to your Kolekto account to continue'}
              </p>
            </div>

            {/* context banner for collection publish flow */}
            {isCollectionFlow && (
              <motion.div
                className="mb-5 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-700">
                  Your collection is saved. Sign in to publish it and start collecting payments.
                </p>
              </motion.div>
            )}

            {/* form card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
              <LoginForm redirectTo={redirectTo} prefillEmail={prefillEmail} />
            </div>

            {/* mobile value blurb */}
            <p className="lg:hidden mt-6 text-center text-xs text-gray-400">
              Easily collect &amp; track group payments with Kolekto
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
