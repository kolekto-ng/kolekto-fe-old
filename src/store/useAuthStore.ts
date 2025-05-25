
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { AuthState, User } from '@/types';
import { toast } from 'sonner';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      set({ 
        user: data.user as User, 
        session: data.session,
        isLoading: false 
      });
      
      return data.user as User;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  getCurrentUser: async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      set({ user: data.user as User });
      return data.user as User;
    }
    set({ user: null });
    return null;
  },
  
  signup: async (email, password, fullName) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });
      
      if (error) throw error;
      
      set({ 
        user: data.user as User, 
        session: data.session,
        isLoading: false 
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, session: null, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  refreshUser: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (data?.session) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError) throw userError;
        
        set({
          user: userData?.user as User,
          session: data.session,
          isLoading: false
        });
      } else {
        set({ user: null, session: null, isLoading: false });
      }
    } catch (error: any) {
      console.error('Error refreshing user:', error);
      set({ error: error.message, isLoading: false });
    }
  }
}));

// Initialize auth state
export const initializeAuth = async () => {
  const authStore = useAuthStore.getState();
  
  // Set up auth state listener
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    
    // Update the store's state
    useAuthStore.setState({
      user: session?.user as User || null,
      session,
      isLoading: false
    });
    
    // Handle different auth events
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      toast.success('Signed in successfully');
    } else if (event === 'SIGNED_OUT') {
      toast.info('Signed out');
    }
  });
  
  // Check for existing session
  await authStore.refreshUser();
};
