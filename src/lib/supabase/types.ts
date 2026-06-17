export type MembershipTier = 'bronze' | 'silver' | 'gold';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; email: string; first_name?: string | null; last_name?: string | null; avatar_url?: string | null };
        Update: { first_name?: string | null; last_name?: string | null; avatar_url?: string | null; updated_at?: string };
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          tier: MembershipTier;
          points: number;
          total_spent: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; tier?: MembershipTier; points?: number; total_spent?: number };
        Update: { tier?: MembershipTier; points?: number; total_spent?: number; updated_at?: string };
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          product_handle: string;
          product_title: string;
          product_image: string | null;
          product_price: number | null;
          created_at: string;
        };
        Insert: { user_id: string; product_id: string; product_handle: string; product_title: string; product_image?: string | null; product_price?: number | null };
        Update: never;
      };
      reviews: {
        Row: {
          id: string;
          product_id: string;
          product_handle: string;
          rating: number;
          body: string;
          nickname: string;
          email: string;
          verified_purchase: boolean;
          approved: boolean;
          created_at: string;
        };
        Insert: {
          product_id: string;
          product_handle: string;
          rating: number;
          body: string;
          nickname: string;
          email: string;
          verified_purchase?: boolean;
          approved?: boolean;
        };
        Update: { approved?: boolean };
      };
      restock_alerts: {
        Row: {
          id: string;
          email: string;
          product_id: string;
          product_handle: string;
          size: string;
          color: string;
          notified: boolean;
          created_at: string;
        };
        Insert: {
          email: string;
          product_id: string;
          product_handle: string;
          size: string;
          color: string;
        };
        Update: { notified?: boolean };
      };
      cart_snapshots: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          items: unknown;
          reminder_sent: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
          items: unknown;
          reminder_sent?: boolean;
        };
        Update: {
          items?: unknown;
          reminder_sent?: boolean;
          updated_at?: string;
        };
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          phone: string | null;
          address_line1: string;
          address_line2: string | null;
          city: string;
          state: string;
          zip: string;
          country: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name: string;
          phone?: string | null;
          address_line1: string;
          address_line2?: string | null;
          city: string;
          state: string;
          zip: string;
          country?: string;
          is_default?: boolean;
        };
        Update: {
          full_name?: string;
          phone?: string | null;
          address_line1?: string;
          address_line2?: string | null;
          city?: string;
          state?: string;
          zip?: string;
          country?: string;
          is_default?: boolean;
          updated_at?: string;
        };
      };
    };
  };
};
