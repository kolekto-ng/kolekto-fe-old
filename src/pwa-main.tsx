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
import PwaDashboard from './pages/pwa/Dashboard'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider>
      <BrowserRouter basename="/pwa">
        <PwaLayout>
          <Routes>
            {/* Root redirects to login (removed splash screen) */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<PwaLogin />} />
            <Route path="/register" element={<PwaRegister />} />
            <Route path="/forgot-password" element={<PwaForgotPassword />} />
            <Route path="/reset-password" element={<PwaResetPassword />} />
            <Route path="/dashboard" element={<PwaDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PwaLayout>
        <Toaster />
        <Sonner />
      </BrowserRouter>
    </TooltipProvider>
  </React.StrictMode>
)


