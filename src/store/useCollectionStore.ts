
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Collection, CollectionState, FormField, PriceTier } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collections: [],
  currentCollection: null,
  isLoading: false,
  error: null,
  
  fetchCollections: async (userId?: string) => {
    set({ isLoading: true, error: null });
    try {
      let query = supabase
        .from('collections')
        .select(`
          *,
          contributions!inner(count)
        `)
        .eq('contributions.status', 'paid')
        .order('created_at', { ascending: false });
        
      if (userId) {
        query = query.eq('organizer_id', userId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Format data with proper type casting
      const formattedData = data?.map(collection => ({
        ...collection,
        formattedAmount: formatCurrency(collection.amount),
        formattedDate: formatDate(collection.created_at),
        form_fields: Array.isArray(collection.form_fields) 
          ? (collection.form_fields as unknown as FormField[])
          : [],
        pricing_tiers: Array.isArray(collection.pricing_tiers) 
          ? (collection.pricing_tiers as unknown as PriceTier[])
          : [],
        participants_count: Array.isArray(collection.contributions) ? collection.contributions.length : 0
      })) || [];
      
      set({ 
        collections: formattedData as Collection[],
        isLoading: false
      });
      
      return formattedData as Collection[];
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchCollectionById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('collections')
        .select(`
          *,
          contributions!inner(count)
        `)
        .eq('contributions.status', 'paid')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Format data with proper type casting
      const formattedData = {
        ...data,
        formattedAmount: formatCurrency(data.amount),
        formattedDate: formatDate(data.created_at),
        form_fields: Array.isArray(data.form_fields) 
          ? (data.form_fields as unknown as FormField[])
          : [],
        pricing_tiers: Array.isArray(data.pricing_tiers) 
          ? (data.pricing_tiers as unknown as PriceTier[])
          : [],
        participants_count: Array.isArray(data.contributions) ? data.contributions.length : 0
      };
      
      set({ 
        currentCollection: formattedData as Collection,
        isLoading: false
      });
      
      return formattedData as Collection;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  createCollection: async (collectionData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('collections')
        .insert({
          organizer_id: collectionData.organizer_id!,
          title: collectionData.title!,
          description: collectionData.description,
          amount: collectionData.amount!,
          deadline: collectionData.deadline,
          max_participants: collectionData.max_participants,
          form_fields: collectionData.form_fields || [],
          pricing_tiers: collectionData.pricing_tiers || [],
          status: collectionData.status || 'active'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Format the new collection data with proper type casting
      const formattedCollection = {
        ...data,
        formattedAmount: formatCurrency(data.amount),
        formattedDate: formatDate(data.created_at),
        form_fields: Array.isArray(data.form_fields) 
          ? (data.form_fields as unknown as FormField[])
          : [],
        pricing_tiers: Array.isArray(data.pricing_tiers) 
          ? (data.pricing_tiers as unknown as PriceTier[])
          : [],
        participants_count: 0
      } as Collection;
      
      // Add the new collection to the state
      set(state => ({
        collections: [formattedCollection, ...state.collections],
        isLoading: false
      }));
      
      return formattedCollection;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateCollection: async (id, collectionData) => {
    set({ isLoading: true, error: null });
    try {
      const updateData: any = {};
      
      // Only include defined properties in the update
      if (collectionData.title !== undefined) updateData.title = collectionData.title;
      if (collectionData.description !== undefined) updateData.description = collectionData.description;
      if (collectionData.amount !== undefined) updateData.amount = collectionData.amount;
      if (collectionData.deadline !== undefined) updateData.deadline = collectionData.deadline;
      if (collectionData.max_participants !== undefined) updateData.max_participants = collectionData.max_participants;
      if (collectionData.form_fields !== undefined) updateData.form_fields = collectionData.form_fields;
      if (collectionData.pricing_tiers !== undefined) updateData.pricing_tiers = collectionData.pricing_tiers;
      if (collectionData.status !== undefined) updateData.status = collectionData.status;
      
      const { data, error } = await supabase
        .from('collections')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Format the updated collection data with proper type casting
      const formattedCollection = {
        ...data,
        formattedAmount: formatCurrency(data.amount),
        formattedDate: formatDate(data.created_at),
        form_fields: Array.isArray(data.form_fields) 
          ? (data.form_fields as unknown as FormField[])
          : [],
        pricing_tiers: Array.isArray(data.pricing_tiers) 
          ? (data.pricing_tiers as unknown as PriceTier[])
          : [],
      } as Collection;
      
      // Update the collection in the state
      set(state => {
        const updatedCollections = state.collections.map(collection => 
          collection.id === id ? { ...collection, ...formattedCollection } : collection
        );
        
        const updatedCurrentCollection = state.currentCollection?.id === id ? {
          ...state.currentCollection,
          ...formattedCollection
        } : state.currentCollection;
        
        return {
          collections: updatedCollections,
          currentCollection: updatedCurrentCollection,
          isLoading: false
        };
      });
      
      return formattedCollection;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  }
}));
