
import React, { useState } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import RegisterStep from '@/components/auth/RegisterStep';

const RegisterPage: React.FC = () => {
  // Redirect authenticated users to dashboard
  useAuthRedirect({ redirectIfAuthenticated: true });
  return (
    
   <div className="max-w-none w-screen px-0">
            <RegisterStep />
          </div>
       
  );
};

export default RegisterPage;
