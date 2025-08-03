import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signUp: (email: string, password: string, fullName: string, phoneNumber?: string) => Promise<{ error: any | null }>;
  signOut: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<{ error: any | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);


  const navigate = useNavigate();
  const location = useLocation();

  // Toast/modal component for session expiration warning
  const ExpiryToast = () => (
    <div className="fixed bottom-5 right-5 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded shadow">
      ⚠️ You will be logged out in 2 minutes due to inactivity. Please save your work.
    </div>
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);

        setUser(session?.user ?? null);

        const isContributeRoute = location.pathname.startsWith('/contribute');
        const isPaymentRoute = location.pathname.startsWith('/payment');
        const isAuthRoute =
          location.pathname === '/login' ||
          location.pathname === '/register' ||
          location.pathname === '/forgot-password';

        if (event === 'SIGNED_IN' && session && isAuthRoute) {
          // Only redirect if user is on an auth page
          setTimeout(() => {
            navigate('/dashboard');
          }, 0);
        } else if (event === 'SIGNED_OUT' && !isContributeRoute) {
          setTimeout(() => {
            navigate('/login');
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  // Check for session expiration every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (session?.expires_at) {
        const currentTime = Math.floor(Date.now() / 1000);
        const timeLeft = session.expires_at - currentTime;

        if (timeLeft <= 120 && timeLeft > 0) {
          // Show warning 2 minutes before expiry
          setShowExpiryWarning(true);
        }

        if (timeLeft <= 0) {
          supabase.auth.signOut();
          navigate('/login');
        }
      }
    }, 30000); // every 30 seconds

    return () => clearInterval(interval);
  }, [session, navigate]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, phoneNumber?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phoneNumber,
        },
      },
    });
    return { error };
  };

  const sendMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/login',
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
    sendMagicLink,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showExpiryWarning && <ExpiryToast />}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
