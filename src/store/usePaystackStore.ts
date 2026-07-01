import { create } from "zustand";
import { PaystackState } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { axiosInstance } from "@/utils/axios";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

export const usePaystackStore = create((set) => ({
  isInitiating: false,
  isVerifying: false,
  error: null,
  paymentLoading: false,

  initializePayment: async (data) => {
    set({ isInitiating: true });
    try {
      const response = await axiosInstance.post(
        "/payments/initialize-payment",
        data
      );
      set({ isInitiating: false });
      toast.success("Payment started");

      return {
        authorization_url: response.data.authorizationUrl,
        reference: response.data.reference,
      };
    } catch (error: any) {
      console.error("Payment initialization failed:", error);
      set({ isInitiating: false });
      toast.error(toFriendlyErrorMessage(error, "We could not start your payment. Please try again."));
      return undefined;
    }
  },

  // initiatePayment: async (data) => {
  //   set({ isInitiating: true, error: null });
  //   try {
  //     // Call edge function to initialize payment
  //     const { data: response, error } = await supabase.functions.invoke('initiate-paystack-payment', {
  //       body: {
  //         email: data.email,
  //         amount: data.amount,
  //         metadata: data.metadata
  //       }
  //     });

  //     if (error) throw new Error(error.message);
  //     if (!response?.authorization_url || !response?.reference) {
  //       throw new Error('Invalid response from payment provider');
  //     }

  //     set({ isInitiating: false });
  //     return {
  //       authorization_url: response.authorization_url,
  //       reference: response.reference
  //     };
  //   } catch (error: any) {
  //     set({ error: error.message, isInitiating: false });
  //     throw error;
  //   }
  // },

  verifyPayment: async (reference) => {
    set({ isVerifying: true, error: null });
    try {
      const { data: response, error } = await supabase.functions.invoke(
        "verify-paystack-payment",
        { body: { reference } }
      );

      if (error) throw new Error(error.message);

      set({ isVerifying: false });
      // Edge function returns { status, receiptData, contributions, ... } at top level
      return response || {};
    } catch (error: any) {
      const message = toFriendlyErrorMessage(error, "We could not verify your payment. Please try again.");
      set({ error: message, isVerifying: false });
      throw new Error(message);
    }
  },
}));
