import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/ui/toaster'
import { Toaster as Sonner } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import PwaLayout from './layouts/PwaLayout'
import PwaLogin from './pages/pwa/auth/Login'
import PwaRegister from './pages/pwa/auth/Register'
import PwaForgotPassword from './pages/pwa/auth/ForgotPassword'
import PwaResetPassword from './pages/pwa/auth/ResetPassword'
import PwaDashboard from './pages/pwa/pages/Dashboard'
import './index.css'
import PwaCreateCollection from './pages/pwa/pages/CreateCollection'
import PwaAppLayout from './pages/pwa/PwaAppLayout';
import PwaCollections from './pages/pwa/pages/Collections'
import PwaProfile from './pages/pwa/pages/Profile'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider>
      <BrowserRouter basename="/pwa">
        <Routes>
          <Route path="/login" element={<PwaLogin />} />
          <Route path="/register" element={<PwaRegister />} />

          {/* All app pages use PwaAppLayout */}
          <Route element={<PwaAppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PwaDashboard />} />
            <Route path="/create-collection" element={<PwaCreateCollection />} />
            <Route path="/collections" element={<PwaCollections />} />
            <Route path="/wallet" element={<div>Wallet Page</div>} />
            <Route path="/profile" element={<PwaProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* Toaster at top */}
        <div className="fixed top-6 left-0 right-0 flex justify-center items-start z-50 pointer-events-none">
          <div className="pointer-events-auto">
            <Toaster />
          </div>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </React.StrictMode>
)


