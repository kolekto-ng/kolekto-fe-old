// Supabase schema types.
//
// ⚠️ HAND-MAINTAINED, NOT GENERATED — and therefore prone to drift. It covers
// only a handful of the ~50 tables that actually exist. Treat a table's absence
// here as "not yet typed", never as "does not exist".
//
// 2026-08-12 (Phase 1.5 remediation): removed two PHANTOM table declarations,
// `transactions` and `payment_config`. Neither exists in the test OR the
// production database — no migration has ever created them and nothing reads or
// writes them. Their presence here caused repeated false conclusions, including
// a documented (and wrong) claim that prod had a `transactions` table that
// needed workspace ownership.
//
// What "transactions" means in Kolekto: a DERIVED VIEW composed at read time
// from `collections` + `contributions` + `withdrawals` (see
// store/useTransactionStore.ts). The durable payment records are `contributions`
// and `deposits`. Do NOT create a `transactions` table to satisfy this file.
//
// Prefer regenerating from the live schema over editing by hand:
//   supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      collections: {
        Row: {
          amount: number;
          created_at: string | null;
          deadline: string | null;
          deleted_at: string | null;
          description: string | null;
          form_fields: Json | null;
          id: string;
          max_participants: number | null;
          organizer_id: string;
          pricing_tiers: Json | null;
          status: string;
          title: string;
          total_amount: number | null;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          deadline?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          form_fields?: Json | null;
          id?: string;
          max_participants?: number | null;
          organizer_id: string;
          pricing_tiers?: Json | null;
          status?: string;
          title: string;
          total_amount?: number | null;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          deadline?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          form_fields?: Json | null;
          id?: string;
          max_participants?: number | null;
          organizer_id?: string;
          pricing_tiers?: Json | null;
          status?: string;
          title?: string;
          total_amount?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "collections_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      contributions: {
        Row: {
          amount: number;
          collection_id: string;
          contact_info: Json | null;
          contributor_email: string;
          contributor_id: string;
          contributor_name: string;
          contributor_phone: string | null;
          created_at: string | null;
          id: string;
          payment_method: string;
          payment_reference: string | null;
          receipt_details: Json | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          collection_id: string;
          contact_info?: Json | null;
          contributor_email: string;
          contributor_id: string;
          contributor_name: string;
          contributor_phone?: string | null;
          created_at?: string | null;
          id?: string;
          payment_method?: string;
          payment_reference?: string | null;
          receipt_details?: Json | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          collection_id?: string;
          contact_info?: Json | null;
          contributor_email?: string;
          contributor_id?: string;
          contributor_name?: string;
          contributor_phone?: string | null;
          created_at?: string | null;
          id?: string;
          payment_method?: string;
          payment_reference?: string | null;
          receipt_details?: Json | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contributions_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          created_at: string | null;
          email: string;
          full_name: string;
          id: string;
          is_organizer: boolean | null;
          phone_number: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          full_name: string;
          id: string;
          is_organizer?: boolean | null;
          phone_number?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_organizer?: boolean | null;
          phone_number?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      withdrawals: {
        Row: {
          account_name: string;
          account_number: string;
          amount: number;
          bank_name: string;
          collection_id: string | null;
          created_at: string | null;
          id: string;
          organizer_id: string;
          reason_if_failed: string | null;
          reference: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          account_name: string;
          account_number: string;
          amount: number;
          bank_name: string;
          collection_id?: string | null;
          created_at?: string | null;
          id?: string;
          organizer_id: string;
          reason_if_failed?: string | null;
          reference?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          account_name?: string;
          account_number?: string;
          amount?: number;
          bank_name?: string;
          collection_id?: string | null;
          created_at?: string | null;
          id?: string;
          organizer_id?: string;
          reason_if_failed?: string | null;
          reference?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "withdrawals_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "withdrawals_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      // Curated public surface for contribute/payment pages. Backed by
      // database/s3_public_collection_view_2026-08-12.sql. Anonymous visitors
      // read THIS, not the `collections` base table, which no longer grants
      // anon SELECT. Deliberately omits user_id, next_contributor_number,
      // rejection_reason and workspace_id.
      public_collection_view: {
        Row: {
          id: string;
          slug: string | null;
          created_at: string | null;
          title: string;
          description: string | null;
          banner_url: string | null;
          amount: number;
          currency: string;
          currency_symbol: string;
          fee_bearer: string;
          target_amount: number | null;
          min_contribution: number | null;
          price_tiers: Json | null;
          status: string;
          type: string;
          collection_type: string | null;
          deadline: string | null;
          event_date: string | null;
          ticket_mode: string | null;
          max_contributions: number | null;
          total_contributions: number;
          allow_multiple_quantity: boolean | null;
          is_open_ended: boolean | null;
          unique_id_enabled: boolean | null;
          contributions_fields: Json | null;
          code_prefix: string | null;
          support_phone_number: string;
          story: Json | null;
          story_images: Json | null;
          campaign_summary: string | null;
          campaign_category: string | null;
          campaign_keywords: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
