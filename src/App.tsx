import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
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
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CollectionDetailsPage = lazy(() => import("./pages/dashboard/CollectionDetailsPage"));
import { AuthProvider } from "./context/AuthContext";
const UserProfilePage = lazy(() => import("./pages/dashboard/UserProfilePage"));
const PaymentCallback = lazy(() => import("./components/contribute/paymentCallback"));
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import "aos/dist/aos.css";
import WhatsAppButton from "./components/WhatsappFloatButton";
import { supabase } from "./integrations/supabase/client";
// Create query client outside of the component to avoid React hooks issues
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuthStore() as any;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-kolekto" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Auth layout that wraps all routes
const AuthenticatedApp = () => {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-kolekto" />
        </div>
      }
    >
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
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/help" element={<HelpCenterPage />} />
      <Route path="/payment/verify" element={<PaymentCallback />} />

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
    import("aos")
      .then((mod) => mod.default)
      .then((AOS) => {
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

  useEffect(() => {
    const syncSession = (session: any) => {
      if (session?.access_token && session?.user) {
        localStorage.setItem("kolekto-auth-token", JSON.stringify(session));
        useAuthStore.setState({
          user: session.user,
          session,
          isLoading: false,
          error: null,
        } as any);
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      syncSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);



  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthenticatedApp />
      <WhatsAppButton />
      {/* <AuthSessionWatcher /> */}
    </TooltipProvider>
  );
};

export default App;

// export function AuthSessionWatcher() {
//   const { user, checkAuth, signOut } = useAuthStore() as any;
//   console.log("auth watcher FaRunning...");


//   useEffect(() => {
//     // Check authentication status on app load
//     checkAuth();
//   }, [checkAuth]);

//   useEffect(() => {
//     const onFocus = () => {
//       // Check auth status when window regains focus
//       if (user) {
//         checkAuth();
//       }
//     };

//     const onStorageChange = (e: StorageEvent) => {
//       // Listen for changes to auth token in other tabs
//       if (e.key === "kolekto-auth-token") {
//         if (!e.newValue) {
//           // Token was removed, sign out
//           signOut();
//         } else {
//           // Token was updated, check auth
//           checkAuth();
//         }
//       }
//     };

//     window.addEventListener("focus", onFocus);
//     window.addEventListener("storage", onStorageChange);

//     return () => {
//       window.removeEventListener("focus", onFocus);
//       window.removeEventListener("storage", onStorageChange);
//     };
//   }, [user, checkAuth, signOut]);

//   return null;
// }
