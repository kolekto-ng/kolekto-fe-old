import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardPage from "./pages/dashboard/DashboardPage";
import CreateCollectionPage from "./pages/dashboard/CreateCollectionPage";
import CollectionsPage from "./pages/dashboard/CollectionsPage";
// import ProfilePage from "./pages/dashboard/ProfilePage";
import TransactionHistoryPage from "./pages/dashboard/TransactionHistoryPage";
import ContributePage from "./pages/contribute/ContributePage";
import NotFound from "./pages/NotFound";
import CollectionDetailsPage from "./pages/dashboard/CollectionDetailsPage";
import { AuthProvider } from "./context/AuthContext";
import UserProfilePage from "./pages/dashboard/UserProfilePage";
import { useEffect } from "react";
import PaymentCallback from "./components/contribute/paymentCallback";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import KolektoCampusSignup from "./pages/KolektoCampus";
import AOS from 'aos';
import 'aos/dist/aos.css';
import WhatsAppButton from "./components/WhatsappFloatButton";
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
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/kolekto-campus" element={<KolektoCampusSignup />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={
        <GoogleReCaptchaProvider reCaptchaKey="6LeWENorAAAAALS4O9P-c-x1e65yu-U5bt8XGp-t">
          <RegisterPage />
        </GoogleReCaptchaProvider>
      } />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/contribute/:collectionId" element={<ContributePage />} />
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
        <Route index element={<DashboardLayout />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="collections/:id" element={<CollectionDetailsPage />} />
        <Route path="create-collection" element={<CreateCollectionPage />} />
        <Route path="settings" element={<UserProfilePage />} />
        <Route path="transactions" element={<TransactionHistoryPage />} />
      </Route>

      {/* Catch-all for 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Main App component restructured to fix React hooks issues
const App = () => {

  useEffect(
    () => {
      AOS.init({
        offset: 120, // offset (in px) from the original trigger point
        delay: 0, // delay in ms
        duration: 1000, // animation duration
        easing: 'ease', // easing option
        once: false, // whether animation should happen only once
        mirror: false, // whether elements animate out while scrolling past
        anchorPlacement: 'top-bottom', // defines trigger position
      });
    }
    , [])



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
