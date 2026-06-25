import { axiosInstance } from "@/utils/axios";
import { toast } from "@/lib/toast";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

interface Collection {
  id: string;
  title: string;
  amount: number;
  total_raised: number;
}

interface Withdrawal {
  id: string;
  status: "pending" | "successful" | "failed";
  amount: number;
  created_at: string;
  collections?: { title: string };
  reason_if_failed?: string;
}

interface Payment {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  amount: number;
  paymentReference: string;
  status: "pending" | "successful" | "failed";
  contributor: { name: string; email: string } | null;
  collection: string;
  created_at: string;
}

export const useTransactions = () => {
  const fetchCollections = async (userId?: string) => {
    if (!userId) {
      toast.error("User ID is required");
      return { data: [], loading: false, error: "User ID is required" };
    }
    try {
      const response = await axiosInstance.get(`/collections`);

      return {
        data: response?.data.data,
        loading: false,
        error: null,
      };
    } catch (error: any) {
      const message = toFriendlyErrorMessage(error, "Could not load collections. Please try again.");
      toast.error(message);
      return { data: [], loading: false, error: message };
    }
  };

  const fetchPayments = async (userId?: string) => {
    if (!userId) {
      toast.error("User ID is required");
      return { data: [], loading: false, error: "User ID is required" };
    }
    try {
      const response = await axiosInstance.get(`/payments`);
      return {
        data: response.data.payments as Payment[],
        loading: false,
        error: null,
      };
    } catch (error: any) {
      const message = toFriendlyErrorMessage(error, "Could not load payments. Please try again.");
      toast.error(message);
      return { data: [], loading: false, error: message };
    }
  };

  const fetchWithdrawals = async (userId?: string) => {
    if (!userId) {
      toast.error("User ID is required");
      return { data: [], loading: false, error: "User ID is required" };
    }
    try {
      const response = await axiosInstance.get(`/withdrawals`);

      return {
        data: (response.data.withdrawals as Withdrawal[]) || [],
        loading: false,
        error: null,
      };
    } catch (error: any) {
      const message = toFriendlyErrorMessage(error, "Could not load withdrawals. Please try again.");
      toast.error(message);
      return { data: [], loading: false, error: message };
    }
  };

  const submitWithdrawal = async (data: {
    organizer_id: string;
    collection_id: string;
    amount: number;
    account_name: string;
    account_number: string;
    bank_name: string;
  }) => {
    try {
      const response = await axiosInstance.post("/withdrawals", data);
      toast.success("Withdrawal request sent");
      return response.data;
    } catch (error: any) {
      const message = toFriendlyErrorMessage(error, "Could not submit withdrawal. Please try again.");
      toast.error(message);
      throw new Error(message);
    }
  };

  return {
    fetchCollections,
    fetchPayments,
    fetchWithdrawals,
    submitWithdrawal,
  };
};
