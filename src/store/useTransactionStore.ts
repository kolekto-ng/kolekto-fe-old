
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, TransactionState } from '@/types';

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  financialSummary: null,
  isLoading: false,
  error: null,
  
  fetchTransactions: async (userId?: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!userId) throw new Error('User ID is required');
      
      // Get user's collections first
      const { data: collections } = await supabase
        .from('collections')
        .select('id, title')
        .eq('user_id', userId);

      if (!collections || collections.length === 0) {
        set({ transactions: [], isLoading: false });
        return [];
      }

      const collectionIds = collections.map(c => c.id);
      
      // Get contributions as transactions
      const { data: contributions } = await supabase
        .from('contributions')
        .select('*')
        .in('collection_id', collectionIds)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      // Get withdrawals as transactions
      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('*')
        .in('collection_id', collectionIds)
        .order('created_at', { ascending: false });

      // Combine and format as transactions
      const allTransactions: Transaction[] = [];

      if (contributions) {
        contributions.forEach(contribution => {
          allTransactions.push({
            id: contribution.id,
            user_id: userId,
            collection_id: contribution.collection_id,
            contribution_id: contribution.id,
            withdrawal_id: null,
            amount: contribution.amount,
            created_at: contribution.created_at,
            description: `Contribution from ${contribution.contributor_name}`,
            type: 'contribution',
            collections: {
              title: collections.find(c => c.id === contribution.collection_id)?.title || 'Unknown'
            }
          });
        });
      }

      if (withdrawals) {
        withdrawals.forEach(withdrawal => {
          allTransactions.push({
            id: withdrawal.id,
            user_id: userId,
            collection_id: withdrawal.collection_id,
            contribution_id: null,
            withdrawal_id: withdrawal.id,
            amount: withdrawal.amount,
            created_at: withdrawal.created_at,
            description: `Withdrawal to ${withdrawal.account_name}`,
            type: 'withdrawal',
            collections: withdrawal.collection_id ? {
              title: collections.find(c => c.id === withdrawal.collection_id)?.title || 'Unknown'
            } : undefined
          });
        });
      }

      // Sort by date
      allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      set({ 
        transactions: allTransactions,
        isLoading: false
      });
      
      return allTransactions;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchFinancialSummary: async (userId?: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!userId) throw new Error('User ID is required');
      
      // Get user's collections
      const { data: collections } = await supabase
        .from('collections')
        .select('id, amount')
        .eq('user_id', userId);

      if (!collections || collections.length === 0) {
        const summary = {
          totalRaised: 0,
          totalWithdrawn: 0,
          availableBalance: 0,
          pendingWithdrawals: 0
        };
        set({ financialSummary: summary, isLoading: false });
        return summary;
      }

      const collectionIds = collections.map(c => c.id);
      
      // Calculate totals
      const { data: contributions } = await supabase
        .from('contributions')
        .select('amount')
        .in('collection_id', collectionIds)
        .eq('status', 'paid');

      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('amount, status')
        .in('collection_id', collectionIds);

      const { isCompletedWithdrawal, isPendingWithdrawal } = await import('@/utils/withdrawalStatus');
      const totalRaised = contributions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      // "completed" was the only status counted before — but the admin-
      // approval path writes "approved", which got dropped from the
      // total. Use the shared helper that mirrors the BE truth function.
      const totalWithdrawn = withdrawals?.filter(w => isCompletedWithdrawal(w.status)).reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
      const pendingWithdrawals = withdrawals?.filter(w => isPendingWithdrawal(w.status)).reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
      const availableBalance = totalRaised - totalWithdrawn - pendingWithdrawals;

      const summary = {
        totalRaised,
        totalWithdrawn,
        availableBalance,
        pendingWithdrawals
      };
      
      set({ 
        financialSummary: summary,
        isLoading: false
      });
      
      return summary;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  }
}));
