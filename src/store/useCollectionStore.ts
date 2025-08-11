import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { Collection, CollectionState, FormField, PriceTier } from "@/types";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { axiosInstance } from "@/utils/axios";

export const useCollectionStore = create((set, get) => ({
  collections: [],
  currentCollection: null,
  isLoading: false,
  error: null,

  fetchCollections: async (userId?: string) => {
    set({ isLoading: true, error: null });
    try {
      // Fetch collections with contributions and filter by paid status
      const res = await axiosInstance.get("/collections");
      console.log("Fetched collections:", res.data);

      const data = res.data.data;
      // Format data with proper type casting
      const formattedData =
        data?.map((collection) => ({
          ...collection,
          formattedAmount: formatCurrency(collection.amount),
          formattedDate: formatDate(collection.created_at),
          form_fields: Array.isArray(collection.contributions_fields)
            ? (collection.contributions_fields as unknown as FormField[])
            : [],
          pricing_tiers: Array.isArray(collection.pricing_tiers)
            ? (collection.pricing_tiers as unknown as PriceTier[])
            : [],
          participants_count: Array.isArray(collection.contributions)
            ? collection.contributions.length
            : 0,
        })) || [];

      set({
        collections: res.data.data,
        isLoading: false,
      });

      return [...formattedData, ...res.data.data];
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchCollectionById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      let currentCollection;
      set((state) => {
        currentCollection = state.collections.find(
          (collection) => collection.id === id
        );
        return {
          currentCollection: state.collections?.find(
            (collection) => collection.id === id
          ),
          isLoading: false,
        };
      });

      return currentCollection;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createCollection: async (collectionData) => {
    set({ isLoading: true, error: null });

    try {
      const res = await axiosInstance.post("/create-collection", {
        ...collectionData,
      });

      // Add the new collection to the state
      set((state) => ({
        collections: [...state.collections, res.data],
        isLoading: false,
      }));

      return res;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });

      console.log("Error creating collection:", error);

      throw error;
    }
  },

  updateCollection: async (id, collectionData) => {
    set({ isLoading: true, error: null });
    try {
      const updateData: any = {};

      // Only include defined properties in the update
      if (collectionData.title !== undefined)
        updateData.title = collectionData.title;
      if (collectionData.description !== undefined)
        updateData.description = collectionData.description;
      if (collectionData.amount !== undefined)
        updateData.amount = collectionData.amount;
      if (collectionData.deadline !== undefined)
        updateData.deadline = collectionData.deadline;
      if (collectionData.max_participants !== undefined)
        updateData.max_participants = collectionData.max_participants;
      if (collectionData.form_fields !== undefined)
        updateData.form_fields = collectionData.form_fields;
      if (collectionData.pricing_tiers !== undefined)
        updateData.pricing_tiers = collectionData.pricing_tiers;
      if (collectionData.status !== undefined)
        updateData.status = collectionData.status;

      const { data, error } = await supabase
        .from("collections")
        .update(updateData)
        .eq("id", id)
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
      set((state) => {
        const updatedCollections = state.collections.map((collection) =>
          collection.id === id
            ? { ...collection, ...formattedCollection }
            : collection
        );

        const updatedCurrentCollection =
          state.currentCollection?.id === id
            ? {
                ...state.currentCollection,
                ...formattedCollection,
              }
            : state.currentCollection;

        return {
          collections: updatedCollections,
          currentCollection: updatedCurrentCollection,
          isLoading: false,
        };
      });

      return formattedCollection;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));
