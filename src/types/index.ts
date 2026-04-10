
// Types for Zustand stores

export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
}

export interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
  refreshUser: () => Promise<void>;
}

export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'time' | 'datetime-local' | 'url' | 'password' | 'textarea' | 'select' | 'radio' | 'checkbox';
  required: boolean;
  options?: string[];
}

export interface PriceTier {
  id?: string;
  name: string;
  price: number;
  description?: string;
  quantity?: number | null;
  prefix?: string | null;
}

export interface Collection {
  id: string;
  organizer_id: string;
  user_id?: string;
  title: string;
  description?: string;
  amount: number;
  deadline?: string;
  max_participants?: number | null;
  max_contributions?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  total_amount?: number | null;
  total_contributions?: number;
  form_fields: FormField[];
  pricing_tiers: PriceTier[];
  price_tiers?: PriceTier[];
  contributions_fields?: FormField[];
  status: string;
  type?: string;
  collection_type?: string;
  slug?: string;
  participants_count?: number;
  fee_bearer?: string;
  target_amount?: number | null;
  min_contribution?: number | null;
  banner_url?: string;
  campaign_summary?: string;
  event_date?: string;
  code_prefix?: string;
  wallets?: any[];
  contributions?: any[];
  story?: { what?: string; why?: string; impact?: string };
  story_images?: string[];
  formattedAmount?: string;
  formattedDate?: string;
  [key: string]: any;
}

export interface Contribution {
  id: string;
  collection_id: string;
  contributor_id: string;
  contributor_name: string;
  contributor_email: string;
  contributor_phone?: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_reference?: string;
  created_at: string;
  updated_at: string;
  receipt_details?: any;
  contact_info?: any;
  formattedAmount?: string;
  formattedDate?: string;
}

export interface Transaction {
  id: string;
  user_id?: string;
  collection_id?: string;
  contribution_id?: string;
  withdrawal_id?: string;
  amount: number;
  created_at: string;
  description?: string;
  type: string;
  collections?: {
    title: string;
  };
}

export interface Withdrawal {
  id: string;
  organizer_id: string;
  collection_id?: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  reference?: string;
  reason_if_failed?: string;
  created_at: string;
  updated_at: string;
  collections?: {
    title: string;
  };
  formattedAmount?: string;
  formattedDate?: string;
}

export interface DashboardStats {
  total_collections: number;
  total_contributions: number;
  total_amount: number;
  active_collections: number;
}

export interface CollectionState {
  collections: Collection[];
  currentCollection: Collection | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchCollections: (userId?: string) => Promise<Collection[]>;
  fetchCollectionById: (id: string) => Promise<Collection>;
  createCollection: (collectionData: Partial<Collection>) => Promise<Collection>;
  updateCollection: (id: string, collectionData: Partial<Collection>) => Promise<Collection>;
}

export interface ContributionState {
  contributions: Contribution[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchContributions: (collectionId?: string) => Promise<Contribution[]>;
  createContribution: (contributionData: Partial<Contribution>) => Promise<Contribution>;
  updateContributionStatus: (id: string, status: string, reference?: string) => Promise<Contribution>;
}

export interface WithdrawalState {
  withdrawals: Withdrawal[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchWithdrawals: (userId?: string, collectionId?: string) => Promise<Withdrawal[]>;
  createWithdrawal: (withdrawalData: {
    amount: number;
    collection_id?: string;
    account_name: string;
    account_number: string;
    bank_name: string;
    organizer_id: string;
  }) => Promise<Withdrawal>;
}

export interface DashboardState {
  stats: DashboardStats | null;
  recentPayments: Transaction[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchDashboardStats: (userId?: string) => Promise<DashboardStats>;
  fetchRecentPayments: (userId?: string, limit?: number) => Promise<Transaction[]>;
}

export interface TransactionState {
  transactions: Transaction[];
  financialSummary: any;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchTransactions: (userId?: string) => Promise<Transaction[]>;
  fetchFinancialSummary: (userId?: string) => Promise<any>;
}

export interface PaystackState {
  isInitiating: boolean;
  isVerifying: boolean;
  error: string | null;
  
  // Actions
  initiatePayment: (data: {
    email: string;
    amount: number;
    metadata: any;
  }) => Promise<{
    authorization_url: string;
    reference: string;
  }>;
  verifyPayment: (reference: string) => Promise<{
    status: string;
    data: any;
  }>;
}
