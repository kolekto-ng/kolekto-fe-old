import { axiosInstance } from "./axios";

export const AMBASSADOR_TOKEN_KEY = "kolekto-ambassador-token";
export const AMBASSADOR_PROFILE_KEY = "kolekto-ambassador-profile";

export type AmbassadorApplicationPayload = {
  full_name: string;
  email: string;
  phone_number: string;
  state: string;
  city: string;
  school_organization: string;
  social_links?: string;
  community_size: number;
  leadership_experience?: string;
  motivation: string;
  promotion_plan: string;
  previous_experience?: string;
};

export function getAmbassadorToken() {
  return localStorage.getItem(AMBASSADOR_TOKEN_KEY);
}

export function setAmbassadorSession(token: string, profile: unknown) {
  localStorage.setItem(AMBASSADOR_TOKEN_KEY, token);
  localStorage.setItem(AMBASSADOR_PROFILE_KEY, JSON.stringify(profile));
}

function updateStoredAmbassadorProfile(profile: unknown) {
  const current = getStoredAmbassadorProfile<Record<string, unknown>>() || {};
  localStorage.setItem(AMBASSADOR_PROFILE_KEY, JSON.stringify({ ...current, ...(profile as Record<string, unknown>) }));
}

export function clearAmbassadorSession() {
  localStorage.removeItem(AMBASSADOR_TOKEN_KEY);
  localStorage.removeItem(AMBASSADOR_PROFILE_KEY);
}

export function getStoredAmbassadorProfile<T = any>(): T | null {
  const raw = localStorage.getItem(AMBASSADOR_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function ambassadorHeaders() {
  const token = getAmbassadorToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function submitAmbassadorApplication(payload: AmbassadorApplicationPayload) {
  const { data } = await axiosInstance.post("/ambassadors/apply", payload);
  return data;
}

export async function signInAmbassador(email: string, ambassadorCode: string, pin: string) {
  const { data } = await axiosInstance.post("/ambassadors/auth/signin", {
    email,
    ambassador_code: ambassadorCode,
    pin,
  });
  setAmbassadorSession(data.token, data.ambassador);
  return data;
}

export async function setupAmbassadorPin(email: string, ambassadorCode: string, pin: string, confirmPin: string) {
  const { data } = await axiosInstance.post("/ambassadors/auth/setup-pin", {
    email,
    ambassador_code: ambassadorCode,
    pin,
    confirm_pin: confirmPin,
  });
  setAmbassadorSession(data.token, data.ambassador);
  return data;
}

export async function getAmbassadorOverview() {
  const { data } = await axiosInstance.get("/ambassadors/overview", { headers: ambassadorHeaders() });
  if (data?.profile) updateStoredAmbassadorProfile(data.profile);
  return data;
}

export async function getAmbassadorEarnings() {
  const { data } = await axiosInstance.get("/ambassadors/earnings", { headers: ambassadorHeaders() });
  return data;
}

export async function getAmbassadorBadges() {
  const { data } = await axiosInstance.get("/ambassadors/badges", { headers: ambassadorHeaders() });
  return data;
}

export async function getAmbassadorLeaderboard() {
  const { data } = await axiosInstance.get("/ambassadors/leaderboard", { headers: ambassadorHeaders() });
  return data;
}

export async function getAmbassadorResources() {
  const { data } = await axiosInstance.get("/ambassadors/resources", { headers: ambassadorHeaders() });
  return data;
}

export async function getAmbassadorPayoutAccounts() {
  const { data } = await axiosInstance.get("/ambassadors/payout-accounts", { headers: ambassadorHeaders() });
  return data;
}

export async function saveAmbassadorPayoutAccount(payload: {
  bankName: string;
  bankCode?: string;
  accountName: string;
  accountNumber: string;
}) {
  const { data } = await axiosInstance.post("/ambassadors/payout-accounts", payload, { headers: ambassadorHeaders() });
  return data;
}

export async function getAmbassadorWithdrawals() {
  const { data } = await axiosInstance.get("/ambassadors/withdrawals", { headers: ambassadorHeaders() });
  return data;
}

export async function requestAmbassadorWithdrawal(payload: {
  payoutAccountId: string;
  amount: number;
}) {
  const { data } = await axiosInstance.post("/ambassadors/withdrawals", payload, { headers: ambassadorHeaders() });
  return data;
}
