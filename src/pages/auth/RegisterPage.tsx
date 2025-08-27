
import React from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import RegisterForm from '@/components/auth/RegisterForm';
import Logo from '@/components/Logo';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

const RegisterPage: React.FC = () => {
  // Redirect authenticated users to dashboard
  useAuthRedirect({ redirectIfAuthenticated: true });

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mt-4">Create an Account</h1>
            <p className="text-gray-600 mt-2">
              Start collecting payments from your group with ease
            </p>
          </div>

          <div className="bg-white shadow-md rounded-xl p-6 border">
            <RegisterForm />
          </div>
        </div>
      </main>

    </div>
  );
};

export default RegisterPage;
