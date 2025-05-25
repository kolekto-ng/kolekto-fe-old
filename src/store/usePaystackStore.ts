
import { create } from 'zustand';
import { PaystackState } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export const usePaystackStore = create<PaystackState>((set) => ({
  isInitiating: false,
  isVerifying: false,
  error: null,
  
  initiatePayment: async (data) => {
    set({ isInitiating: true, error: null });
    try {
      // Call edge function to initialize payment
      const { data: response, error } = await supabase.functions.invoke('initiate-paystack-payment', {
        body: {
          email: data.email,
          amount: data.amount,
          metadata: data.metadata
        }
      });
      
      if (error) throw new Error(error.message);
      if (!response?.authorization_url || !response?.reference) {
        throw new Error('Invalid response from payment provider');
      }
      
      set({ isInitiating: false });
      return {
        authorization_url: response.authorization_url,
        reference: response.reference
      };
    } catch (error: any) {
      set({ error: error.message, isInitiating: false });
      throw error;
    }
  },
  
  verifyPayment: async (reference) => {
    set({ isVerifying: true, error: null });
    try {
      // Call edge function to verify payment
      const { data: response, error } = await supabase.functions.invoke('verify-paystack-payment', {
        body: { reference }
      });
      
      if (error) throw new Error(error.message);
      
      set({ isVerifying: false });
      return {
        status: response?.status || 'unknown',
        data: response?.data || null
      };
    } catch (error: any) {
      set({ error: error.message, isVerifying: false });
      throw error;
    }
  }
}));
