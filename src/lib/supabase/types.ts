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
      orders: {
        Row: {
          id: string;
          user_id: string | null;
          shopify_order_id: string;
          shopify_order_number: string;
          email: string;
          phone: string | null;
          financial_status: string | null;
          fulfillment_status: string | null;
          total_amount: number | null;
          currency: string;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string | null;
          shopify_order_id: string;
          shopify_order_number: string;
          email: string;
          phone?: string | null;
          financial_status?: string | null;
          fulfillment_status?: string | null;
          total_amount?: number | null;
          currency?: string;
          processed_at?: string | null;
        };
        Update: {
          user_id?: string | null;
          shopify_order_number?: string;
          email?: string;
          phone?: string | null;
          financial_status?: string | null;
          fulfillment_status?: string | null;
          total_amount?: number | null;
          currency?: string;
          processed_at?: string | null;
          updated_at?: string;
        };
      };
      shipments: {
        Row: {
          id: string;
          order_id: string;
          shopify_fulfillment_id: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          carrier: string | null;
          status: string;
          estimated_delivery_at: string | null;
          shipped_at: string | null;
          delivered_at: string | null;
          public_lookup_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          order_id: string;
          shopify_fulfillment_id?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          carrier?: string | null;
          status?: string;
          estimated_delivery_at?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          public_lookup_token: string;
        };
        Update: {
          shopify_fulfillment_id?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          carrier?: string | null;
          status?: string;
          estimated_delivery_at?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          updated_at?: string;
        };
      };
      shipment_events: {
        Row: {
          id: string;
          shipment_id: string;
          status: string;
          title: string;
          description: string | null;
          location: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          shipment_id: string;
          status: string;
          title: string;
          description?: string | null;
          location?: string | null;
          occurred_at?: string;
        };
        Update: never;
      };
      notification_logs: {
        Row: {
          id: string;
          order_id: string | null;
          shipment_id: string | null;
          channel: 'email' | 'sms';
          event_type: string;
          recipient: string;
          provider_message_id: string | null;
          sent_at: string;
        };
        Insert: {
          order_id?: string | null;
          shipment_id?: string | null;
          channel: 'email' | 'sms';
          event_type: string;
          recipient: string;
          provider_message_id?: string | null;
        };
        Update: never;
      };
    };
  };
};
