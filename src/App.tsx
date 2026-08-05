import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KycRequiredModal } from "@/components/kyc/KycRequiredModal";
import { useKycFocusRefetch } from "@/hooks/useKycFocusRefetch";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import React, { Suspense, lazy, useEffect } from "react";
const HomePage = lazy(() => import("./pages/HomePage"));
const CreateCollectionPage = lazy(() => import("./pages/CreateCollectionPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const DashboardCreateCollectionPage = lazy(() => import("./pages/dashboard/CreateCollectionPage"));
const CollectionsPage = lazy(() => import("./pages/dashboard/CollectionsPage"));
// import ProfilePage from "./pages/dashboard/ProfilePage";
const TransactionHistoryPage = lazy(() => import("./pages/dashboard/TransactionHistoryPage"));
const ActivitiesPage = lazy(() => import("./pages/dashboard/ActivitiesPage"));
const ContributePage = lazy(() => import("./pages/contribute/ContributePage"));
const ActiveCampaignsPage = lazy(() => import("./pages/ActiveCampaignsPage"));
const AmbassadorsPage = lazy(() => import("./pages/AmbassadorsPage"));
const AmbassadorPortal = lazy(() => import("./pages/ambassador/AmbassadorPortal"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CollectionDetailsPage = lazy(() => import("./pages/dashboard/CollectionDetailsPage"));
const UserProfilePage = lazy(() => import("./pages/dashboard/UserProfilePage"));
const PaymentCallback = lazy(() => import("./components/contribute/paymentCallback"));
const ConfirmEmailChangePage = lazy(() => import("./pages/ConfirmEmailChangePage"));
const CollectionTransferPage = lazy(() => import("./pages/CollectionTransferPage"));
const CollectionAccessPage = lazy(() => import("./pages/CollectionAccessPage"));
const SharedCollectionsPage = lazy(() => import("./pages/dashboard/SharedCollectionsPage"));
const SharedCollectionDetailPage = lazy(() => import("./pages/dashboard/SharedCollectionDetailPage"));
import { useAuthStore } from "@/store/useAuthStore";
import WhatsAppButton from "./components/WhatsappFloatButton";
import ScrollToTop from "./components/ScrollToTop";
import SessionTimeoutGuard from "./components/SessionTimeoutGuard";
import { AppRouteSkeleton, DashboardShellSkeleton } from "@/components/ui/page-skeletons";
import PwaUpdatePrompt from "@/components/PwaUpdatePrompt";
const PwaInstallManager = lazy(() => import("@/components/pwa/PwaInstallManager"));
// Create query client outside of the component to avoid React hooks issues
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuthStore() as any;

  if (isLoading) {
    return <DashboardShellSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function getLegacyPwaTarget(pathname: string): string {
  const legacyPath = pathname.replace(/^\/pwa\/?/, "/");
  const normalizedPath = legacyPath === "" ? "/" : legacyPath;

  if (normalizedPath === "/" || normalizedPath === "/dashboard") {
    return "/dashboard";
  }

  if (
    ["/login", "/register", "/forgot-password", "/reset-password"].includes(
      normalizedPath
    )
  ) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/dashboard")) {
    return normalizedPath;
  }

  if (normalizedPath === "/activities") {
    return "/dashboard/activities";
  }

  if (normalizedPath === "/create-collection") {
    return "/dashboard/create-collection";
  }

  if (normalizedPath === "/collections" || normalizedPath.startsWith("/collections/")) {
    return `/dashboard${normalizedPath}`;
  }

  if (normalizedPath === "/wallet") {
    return "/dashboard/transactions";
  }

  if (normalizedPath === "/profile") {
    return "/dashboard/settings";
  }

  return "/dashboard";
}

const LegacyPwaRedirect = () => {
  const location = useLocation();
  const targetPath = getLegacyPwaTarget(location.pathname);

  return (
    <Navigate
      to={`${targetPath}${location.search}${location.hash}`}
      replace
    />
  );
};

const CollectionNotificationRedirect = () => {
  const location = useLocation();
  const { collectionId } = useParams();
  const targetPath = collectionId
    ? `/dashboard/collections/${collectionId}`
    : "/dashboard/collections";

  return (
    <Navigate
      to={`${targetPath}${location.search}${location.hash}`}
      replace
    />
  );
};

// Auth layout that wraps all routes
const AuthenticatedApp = () => {
  const isAmbassadorHost = window.location.hostname.startsWith("ambassador.");

  if (isAmbassadorHost) {
    return (
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-kolekto" />
          </div>
        }
      >
        <Routes>
          <Route path="/*" element={<AmbassadorPortal />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<AppRouteSkeleton />}>
      <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/create-collection" element={<CreateCollectionPage />} />
      {/* Kolekto on Campus route temporarily disabled */}
      {/* <Route path="/kolekto-campus" element={<KolektoCampusSignup />} /> */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={
        <GoogleReCaptchaProvider reCaptchaKey="6LeWENorAAAAALS4O9P-c-x1e65yu-U5bt8XGp-t">
          <RegisterPage />
        </GoogleReCaptchaProvider>
      } />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/contribute/:collectionId" element={<ContributePage />} />
      <Route path="/active-campaigns" element={<ActiveCampaignsPage />} />
      <Route path="/ambassadors" element={<AmbassadorsPage />} />
      <Route path="/ambassador/*" element={<AmbassadorPortal />} />
      <Route path="/collections/:collectionId" element={<CollectionNotificationRedirect />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/help" element={<HelpCenterPage />} />
      <Route path="/payment/verify" element={<PaymentCallback />} />
      <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
      <Route path="/collection-transfer" element={<CollectionTransferPage />} />
      <Route path="/collection-access" element={<CollectionAccessPage />} />
      <Route path="/pwa/*" element={<LegacyPwaRedirect />} />

      {/* Protected Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="collections/:id" element={<CollectionDetailsPage />} />
        <Route path="create-collection" element={<DashboardCreateCollectionPage />} />
        <Route path="settings" element={<UserProfilePage />} />
        <Route path="shared-with-me" element={<SharedCollectionsPage />} />
        <Route path="shared-with-me/:id" element={<SharedCollectionDetailPage />} />
        <Route path="transactions" element={<TransactionHistoryPage />} />
        <Route path="activities" element={<ActivitiesPage />} />
      </Route>

      {/* Catch-all for 404 */}
      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

// Main App component restructured to fix React hooks issues
const App = () => {
  const location = useLocation();
  const isAmbassadorExperience =
    window.location.hostname.startsWith("ambassador.") ||
    location.pathname.startsWith("/ambassador");
  const shouldShowWhatsAppButton =
    !isAmbassadorExperience &&
    !location.pathname.startsWith("/dashboard") &&
    location.pathname !== "/create-collection";

  useEffect(() => {
    // Supabase recovery links may land on the site root depending on allowed redirect URLs.
    // When that happens, route users to the actual reset page while preserving the hash token.
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery") && window.location.pathname === "/") {
      window.location.replace(`/reset-password${hash}`);
    }
  }, []);

  useEffect(() => {
    // AOS is purely a UX enhancement; keep it out of the initial JS chunk.
    Promise.all([import("aos"), import("aos/dist/aos.css")])
      .then(([mod]) => {
        const AOS = mod.default;
        AOS.init({
          offset: 120, // offset (in px) from the original trigger point
          delay: 0, // delay in ms
          duration: 1000, // animation duration
          easing: "ease", // easing option
          once: false, // whether animation should happen only once
          mirror: false, // whether elements animate out while scrolling past
          anchorPlacement: "top-bottom", // defines trigger position
        });
      })
      .catch(() => {
        // optional
      });
  }, []);

  // Part 5 (KYC realtime sync): complements the Supabase channel subscription
  // in useProfileStore with a throttled refetch-on-focus fallback — see
  // hooks/useKycFocusRefetch.ts for why the realtime channel alone isn't
  // fully reliable on mobile.
  useKycFocusRefetch();

  // Auth rehydration is owned entirely by useAuthStore (see the
  // module-level `checkAuth()` trigger in store/useAuthStore.ts): on load,
  // a valid stored token is verified against the backend before
  // ProtectedRoute/DashboardLayout make a redirect decision. This used to
  // also be done here via a mount-effect ("AuthSessionWatcher") that called
  // `checkAuth()` and re-subscribed to Supabase's own auth events — that
  // duplicated the rehydration path and, worse, re-introduced the B-16
  // dual-writer bug (both this watcher and the Supabase client fighting
  // over session state), causing random "logged out" mid-session and ghost
  // SIGNED_OUT-triggered navigations. It has been removed entirely rather
  // than re-enabled, so there is exactly one place that ever calls
  // `checkAuth()` on load.
  //
  // Source-of-truth split:
  //   - `kolekto-auth-token`            → useAuthStore (custom backend JWT)
  //   - `kolekto-supabase-session`      → supabase client (RLS queries)
  // useAuthStore mirrors into the Supabase client via
  // `mirrorSetSessionOnSupabase` on signIn/signUp/signOut.

  return (
    <TooltipProvider>
      <Sonner />
      <PwaUpdatePrompt />
      <ScrollToTop />
      <SessionTimeoutGuard />
      <KycRequiredModal />
      <AuthenticatedApp />
      {shouldShowWhatsAppButton && (
        <Suspense fallback={null}>
          <PwaInstallManager />
        </Suspense>
      )}
      {shouldShowWhatsAppButton && <WhatsAppButton />}
    </TooltipProvider>
  );
};

export default App;
