import { axiosInstance } from "@/utils/axios";
import { profile } from "console";
import { create } from "zustand";

// {
//       banks: { name: "", code: "" },
//       bankCode: null,
//       accountNumber: "",
//       accountName: "",
//     },
export const useSettings = create((set, get) => ({
  profile: null,
  payoutAccounts: [],
  loading: false,

  getProfile: async () => {
    const { data } = await axiosInstance.get("/settings/profile");

    set({ profile: data.data });
  },

  uploadAvatar: async ({ file }) => {
    const res = await axiosInstance.post("/upload-avatar", { file });
    console.log(res, "uploading avatr");
  },

  getBanks: async () => {
    const res = await axiosInstance.get("/settings/profile/banks");
    console.log(res, "get banks from paystack");

    return res;
  },

  verifyAccount: async ({ accountNumber, bankCode }) => {
    set({ loading: true });

    const res = await axiosInstance.post("/settings/profile/verify-account", {
      account_number: accountNumber,
      bank_code: bankCode,
    });
    set({ loading: false });

    return res;
  },

  getPayoutAccounts: async () => {
    const { data } = await axiosInstance.get(
      "/settings/profile/payout-accounts"
    );
    console.log(data, "payunt accounts");

    set({ payoutAccounts: data.data });

    return data.data;
  },
}));
