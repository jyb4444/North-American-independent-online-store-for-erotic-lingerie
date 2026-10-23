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
          user_id: string | null;
          product_id: string;
          product_handle: string;
          rating: number;
          body: string;
          nickname: string;
          email: string;
          verified_purchase: boolean;
          approved: boolean;
          photo_urls: string[];
          video_urls: string[];
          is_anonymous: boolean;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          product_id: string;
          product_handle: string;
          rating: number;
          body: string;
          nickname: string;
          email: string;
          photo_urls?: string[];
          video_urls?: string[];
          is_anonymous?: boolean;
          verified_purchase?: boolean;
          approved?: boolean;
        };
        Update: { approved?: boolean; verified_purchase?: boolean; user_id?: string | null };
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
          attempts: number;
          next_attempt_at: string;
          last_error: string | null;
          created_at: string;
        };
        Insert: {
          email: string;
          product_id: string;
          product_handle: string;
          size: string;
          color: string;
          notified?: boolean;
          attempts?: number;
          next_attempt_at?: string;
          last_error?: string | null;
        };
        Update: { notified?: boolean; attempts?: number; next_attempt_at?: string; last_error?: string | null };
      };
      cart_snapshots: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          items: unknown;
          reminder_sent: boolean;
          reminder_attempts: number;
          reminder_last_error: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
          items: unknown;
          reminder_sent?: boolean;
          reminder_attempts?: number;
          reminder_last_error?: string | null;
        };
        Update: {
          items?: unknown;
          reminder_sent?: boolean;
          reminder_attempts?: number;
          reminder_last_error?: string | null;
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
          shopify_updated_at: string | null;
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
          shopify_updated_at?: string | null;
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
          shopify_updated_at?: string | null;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          shopify_line_item_id: string;
          shopify_variant_id: string | null;
          shopify_product_id: string | null;
          title: string;
          variant_title: string | null;
          sku: string | null;
          quantity: number;
          price: number | null;
          product_type: string | null;
          vendor: string | null;
          return_category: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          order_id: string;
          shopify_line_item_id: string;
          shopify_variant_id?: string | null;
          shopify_product_id?: string | null;
          title: string;
          variant_title?: string | null;
          sku?: string | null;
          quantity?: number;
          price?: number | null;
          product_type?: string | null;
          vendor?: string | null;
          return_category?: string;
        };
        Update: {
          shopify_variant_id?: string | null;
          shopify_product_id?: string | null;
          title?: string;
          variant_title?: string | null;
          sku?: string | null;
          quantity?: number;
          price?: number | null;
          product_type?: string | null;
          vendor?: string | null;
          return_category?: string;
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
      return_requests: {
        Row: {
          id: string;
          user_id: string | null;
          order_id: string;
          request_number: string;
          desired_resolution: 'cancel_order' | 'refund' | 'return_refund' | 'exchange' | 'reship' | 'partial_refund';
          reason: 'quality_issue' | 'wrong_item' | 'missing_item' | 'damaged_in_transit' | 'not_as_expected' | 'changed_mind' | 'size_fit' | 'privacy_packaging' | 'other';
          status: 'submitted' | 'needs_more_info' | 'approved' | 'rejected' | 'awaiting_customer_shipment' | 'customer_shipped' | 'received' | 'inspected' | 'refund_pending' | 'refunded' | 'exchange_pending' | 'exchanged' | 'reship_pending' | 'reshipped' | 'closed';
          eligibility_status: 'eligible' | 'ineligible' | 'review_required';
          policy_notes: string[];
          customer_note: string | null;
          media_urls: string[];
          return_shipping_method: string | null;
          return_carrier: string | null;
          return_tracking_number: string | null;
          return_tracking_url: string | null;
          inspected_at: string | null;
          shopify_sync_status: 'pending' | 'synced' | 'failed' | 'skipped';
          shopify_sync_error: string | null;
          shopify_synced_at: string | null;
          admin_notes: string | null;
          submitted_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string | null;
          order_id: string;
          request_number: string;
          desired_resolution: 'cancel_order' | 'refund' | 'return_refund' | 'exchange' | 'reship' | 'partial_refund';
          reason: 'quality_issue' | 'wrong_item' | 'missing_item' | 'damaged_in_transit' | 'not_as_expected' | 'changed_mind' | 'size_fit' | 'privacy_packaging' | 'other';
          status?: 'submitted' | 'needs_more_info' | 'approved' | 'rejected' | 'awaiting_customer_shipment' | 'customer_shipped' | 'received' | 'inspected' | 'refund_pending' | 'refunded' | 'exchange_pending' | 'exchanged' | 'reship_pending' | 'reshipped' | 'closed';
          eligibility_status?: 'eligible' | 'ineligible' | 'review_required';
          policy_notes?: string[];
          customer_note?: string | null;
          media_urls?: string[];
          return_shipping_method?: string | null;
          return_carrier?: string | null;
          return_tracking_number?: string | null;
          return_tracking_url?: string | null;
          shopify_sync_status?: 'pending' | 'synced' | 'failed' | 'skipped';
          shopify_sync_error?: string | null;
          shopify_synced_at?: string | null;
          admin_notes?: string | null;
        };
        Update: {
          status?: 'submitted' | 'needs_more_info' | 'approved' | 'rejected' | 'awaiting_customer_shipment' | 'customer_shipped' | 'received' | 'inspected' | 'refund_pending' | 'refunded' | 'exchange_pending' | 'exchanged' | 'reship_pending' | 'reshipped' | 'closed';
          eligibility_status?: 'eligible' | 'ineligible' | 'review_required';
          policy_notes?: string[];
          customer_note?: string | null;
          media_urls?: string[];
          return_shipping_method?: string | null;
          return_carrier?: string | null;
          return_tracking_number?: string | null;
          return_tracking_url?: string | null;
          inspected_at?: string | null;
          shopify_sync_status?: 'pending' | 'synced' | 'failed' | 'skipped';
          shopify_sync_error?: string | null;
          shopify_synced_at?: string | null;
          admin_notes?: string | null;
          updated_at?: string;
        };
      };
      return_request_items: {
        Row: {
          id: string;
          return_request_id: string;
          order_item_id: string;
          quantity: number;
          item_condition: 'unopened_tags_attached' | 'opened_unused' | 'used' | 'damaged' | 'defective';
          reason_detail: string | null;
          created_at: string;
        };
        Insert: {
          return_request_id: string;
          order_item_id: string;
          quantity?: number;
          item_condition: 'unopened_tags_attached' | 'opened_unused' | 'used' | 'damaged' | 'defective';
          reason_detail?: string | null;
        };
        Update: never;
      };
      return_request_events: {
        Row: {
          id: string;
          return_request_id: string;
          event_type: string;
          title: string;
          description: string | null;
          metadata: unknown;
          created_at: string;
        };
        Insert: {
          return_request_id: string;
          event_type: string;
          title: string;
          description?: string | null;
          metadata?: unknown;
        };
        Update: never;
      };
    };
  };
};
