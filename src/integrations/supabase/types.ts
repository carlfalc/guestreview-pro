export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_region_audit_log: {
        Row: {
          change_source: string
          changed_by: string | null
          created_at: string
          id: string
          new_country_code: string | null
          new_currency_code: string | null
          new_pricing_region: string | null
          owner_id: string
          previous_country_code: string | null
          previous_currency_code: string | null
          previous_pricing_region: string | null
          reason: string | null
          stripe_event_id: string | null
        }
        Insert: {
          change_source: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_country_code?: string | null
          new_currency_code?: string | null
          new_pricing_region?: string | null
          owner_id: string
          previous_country_code?: string | null
          previous_currency_code?: string | null
          previous_pricing_region?: string | null
          reason?: string | null
          stripe_event_id?: string | null
        }
        Update: {
          change_source?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_country_code?: string | null
          new_currency_code?: string | null
          new_pricing_region?: string | null
          owner_id?: string
          previous_country_code?: string | null
          previous_currency_code?: string | null
          previous_pricing_region?: string | null
          reason?: string | null
          stripe_event_id?: string | null
        }
        Relationships: []
      }
      account_regions: {
        Row: {
          confidence: string
          confirmed_at: string | null
          country_code: string
          country_name: string
          created_at: string
          currency_code: string
          currency_name: string
          currency_symbol: string
          detected_at: string
          detection_source: string
          id: string
          is_locked: boolean
          owner_id: string
          pricing_region: string
          stripe_billing_country: string | null
          updated_at: string
        }
        Insert: {
          confidence: string
          confirmed_at?: string | null
          country_code: string
          country_name: string
          created_at?: string
          currency_code: string
          currency_name: string
          currency_symbol: string
          detected_at?: string
          detection_source: string
          id?: string
          is_locked?: boolean
          owner_id: string
          pricing_region: string
          stripe_billing_country?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: string
          confirmed_at?: string | null
          country_code?: string
          country_name?: string
          created_at?: string
          currency_code?: string
          currency_name?: string
          currency_symbol?: string
          detected_at?: string
          detection_source?: string
          id?: string
          is_locked?: boolean
          owner_id?: string
          pricing_region?: string
          stripe_billing_country?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_copy_favourites: {
        Row: {
          business_id: string | null
          created_at: string
          cta_text: string | null
          footer_text: string | null
          headline: string | null
          id: string
          name: string
          owner_id: string
          placement: string | null
          support_text: string | null
          tone: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          cta_text?: string | null
          footer_text?: string | null
          headline?: string | null
          id?: string
          name: string
          owner_id: string
          placement?: string | null
          support_text?: string | null
          tone?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          cta_text?: string | null
          footer_text?: string | null
          headline?: string | null
          id?: string
          name?: string
          owner_id?: string
          placement?: string | null
          support_text?: string | null
          tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_copy_favourites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_copy_generations: {
        Row: {
          business_id: string | null
          created_at: string
          format_id: string | null
          generated_output: Json
          id: string
          input_summary: string | null
          language: string | null
          marketing_pack_id: string | null
          owner_id: string
          placement: string | null
          selected_alternative: number | null
          tone: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          format_id?: string | null
          generated_output?: Json
          id?: string
          input_summary?: string | null
          language?: string | null
          marketing_pack_id?: string | null
          owner_id: string
          placement?: string | null
          selected_alternative?: number | null
          tone?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          format_id?: string | null
          generated_output?: Json
          id?: string
          input_summary?: string | null
          language?: string | null
          marketing_pack_id?: string | null
          owner_id?: string
          placement?: string | null
          selected_alternative?: number | null
          tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_copy_generations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_copy_generations_marketing_pack_id_fkey"
            columns: ["marketing_pack_id"]
            isOneToOne: false
            referencedRelation: "marketing_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_feedback: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          id: string
          message: string
          owner_id: string
          path: string | null
          rating: number | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          owner_id: string
          path?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          owner_id?: string
          path?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          address: string | null
          address_line_1: string | null
          address_line_2: string | null
          ai_copy_preferences: Json
          brand_primary: string | null
          brand_secondary: string | null
          city: string | null
          country_code: string | null
          cover_image_url: string | null
          created_at: string
          google_review_url: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          postal_code: string | null
          region: string | null
          status: string
          updated_at: string
          website: string | null
          welcome_message: string | null
        }
        Insert: {
          address?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          ai_copy_preferences?: Json
          brand_primary?: string | null
          brand_secondary?: string | null
          city?: string | null
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          google_review_url?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          welcome_message?: string | null
        }
        Update: {
          address?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          ai_copy_preferences?: Json
          brand_primary?: string | null
          brand_secondary?: string | null
          city?: string | null
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          google_review_url?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      checkout_attempts: {
        Row: {
          abandoned_reason: string | null
          amount_minor: number | null
          billing_interval: string
          completed_at: string | null
          created_at: string
          currency_code: string | null
          environment: string
          id: string
          owner_id: string
          plan_key: string
          started_at: string
          status: string
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          abandoned_reason?: string | null
          amount_minor?: number | null
          billing_interval: string
          completed_at?: string | null
          created_at?: string
          currency_code?: string | null
          environment?: string
          id?: string
          owner_id: string
          plan_key: string
          started_at?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          abandoned_reason?: string | null
          amount_minor?: number | null
          billing_interval?: string
          completed_at?: string | null
          created_at?: string
          currency_code?: string | null
          environment?: string
          id?: string
          owner_id?: string
          plan_key?: string
          started_at?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_deliveries: {
        Row: {
          attempt_count: number
          bounced_at: string | null
          business_id: string | null
          created_at: string
          delivered_at: string | null
          email_type: string
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          next_attempt_at: string | null
          owner_id: string | null
          period_start: string | null
          provider: string
          provider_message_id: string | null
          recipient_email: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          bounced_at?: string | null
          business_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email_type: string
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          next_attempt_at?: string | null
          owner_id?: string | null
          period_start?: string | null
          provider?: string
          provider_message_id?: string | null
          recipient_email: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          bounced_at?: string | null
          business_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email_type?: string
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          next_attempt_at?: string | null
          owner_id?: string | null
          period_start?: string | null
          provider?: string
          provider_message_id?: string | null
          recipient_email?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          business_ids: Json
          created_at: string
          local_time: string
          owner_id: string
          portfolio_business_ids: Json
          portfolio_digest_enabled: boolean
          portfolio_local_time: string | null
          portfolio_weekday: number | null
          product_updates_consent_at: string | null
          product_updates_consent_source: string | null
          product_updates_enabled: boolean
          report_format: string
          timezone: string
          unsubscribed_at: string | null
          updated_at: string
          weekday: number
          weekly_report_enabled: boolean
        }
        Insert: {
          business_ids?: Json
          created_at?: string
          local_time?: string
          owner_id: string
          portfolio_business_ids?: Json
          portfolio_digest_enabled?: boolean
          portfolio_local_time?: string | null
          portfolio_weekday?: number | null
          product_updates_consent_at?: string | null
          product_updates_consent_source?: string | null
          product_updates_enabled?: boolean
          report_format?: string
          timezone?: string
          unsubscribed_at?: string | null
          updated_at?: string
          weekday?: number
          weekly_report_enabled?: boolean
        }
        Update: {
          business_ids?: Json
          created_at?: string
          local_time?: string
          owner_id?: string
          portfolio_business_ids?: Json
          portfolio_digest_enabled?: boolean
          portfolio_local_time?: string | null
          portfolio_weekday?: number | null
          product_updates_consent_at?: string | null
          product_updates_consent_source?: string | null
          product_updates_enabled?: boolean
          report_format?: string
          timezone?: string
          unsubscribed_at?: string | null
          updated_at?: string
          weekday?: number
          weekly_report_enabled?: boolean
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          owner_id: string | null
          reason: string
          scope: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          owner_id?: string | null
          reason: string
          scope?: string
          source: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          owner_id?: string | null
          reason?: string
          scope?: string
          source?: string
        }
        Relationships: []
      }
      founder_feedback: {
        Row: {
          admin_notes: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          missing: string | null
          most_important_feature: string | null
          nearly_stopped: string | null
          owner_id: string
          recommend_score: number | null
          setup_ease: number | null
          slot_number: number | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          missing?: string | null
          most_important_feature?: string | null
          nearly_stopped?: string | null
          owner_id: string
          recommend_score?: number | null
          setup_ease?: number | null
          slot_number?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          missing?: string | null
          most_important_feature?: string | null
          nearly_stopped?: string | null
          owner_id?: string
          recommend_score?: number | null
          setup_ease?: number | null
          slot_number?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      founder_slot_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          new_status: string
          owner_id: string
          previous_status: string | null
          reason: string | null
          slot_id: string
          slot_number: number
          source: string
          stripe_event_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          owner_id: string
          previous_status?: string | null
          reason?: string | null
          slot_id: string
          slot_number: number
          source?: string
          stripe_event_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          owner_id?: string
          previous_status?: string | null
          reason?: string | null
          slot_id?: string
          slot_number?: number
          source?: string
          stripe_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_slot_events_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "founding_member_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      founding_member_slots: {
        Row: {
          activated_at: string | null
          billing_interval: string
          created_at: string
          environment: string
          founder_price_id: string | null
          id: string
          owner_id: string
          pricing_region: string
          release_reason: string | null
          released_at: string | null
          reserved_at: string | null
          slot_number: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          billing_interval: string
          created_at?: string
          environment?: string
          founder_price_id?: string | null
          id?: string
          owner_id: string
          pricing_region: string
          release_reason?: string | null
          released_at?: string | null
          reserved_at?: string | null
          slot_number: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          billing_interval?: string
          created_at?: string
          environment?: string
          founder_price_id?: string | null
          id?: string
          owner_id?: string
          pricing_region?: string
          release_reason?: string | null
          released_at?: string | null
          reserved_at?: string | null
          slot_number?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          business_id: string
          created_at: string
          id: string
          identifier: string | null
          location_type: string | null
          name: string
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          identifier?: string | null
          location_type?: string | null
          name: string
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          identifier?: string | null
          location_type?: string | null
          name?: string
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_leads: {
        Row: {
          created_at: string
          email: string
          guide_key: string
          id: string
          industry: string | null
          marketing_consent: boolean
          source_path: string | null
        }
        Insert: {
          created_at?: string
          email: string
          guide_key?: string
          id?: string
          industry?: string | null
          marketing_consent?: boolean
          source_path?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          guide_key?: string
          id?: string
          industry?: string | null
          marketing_consent?: boolean
          source_path?: string | null
        }
        Relationships: []
      }
      marketing_packs: {
        Row: {
          archived_at: string | null
          business_id: string
          created_at: string
          cta_text: string | null
          description: string | null
          footer_text: string | null
          format_customizations: Json
          global_settings: Json
          headline: string | null
          id: string
          layout_template: string
          owner_id: string
          pack_type: string
          preview_url: string | null
          project_name: string
          qr_code_id: string
          selected_formats: Json
          show_business_name: boolean
          show_google_badge: boolean
          show_logo: boolean
          show_stars: boolean
          status: string
          support_text: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          business_id: string
          created_at?: string
          cta_text?: string | null
          description?: string | null
          footer_text?: string | null
          format_customizations?: Json
          global_settings?: Json
          headline?: string | null
          id?: string
          layout_template?: string
          owner_id: string
          pack_type?: string
          preview_url?: string | null
          project_name: string
          qr_code_id: string
          selected_formats?: Json
          show_business_name?: boolean
          show_google_badge?: boolean
          show_logo?: boolean
          show_stars?: boolean
          status?: string
          support_text?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          business_id?: string
          created_at?: string
          cta_text?: string | null
          description?: string | null
          footer_text?: string | null
          format_customizations?: Json
          global_settings?: Json
          headline?: string | null
          id?: string
          layout_template?: string
          owner_id?: string
          pack_type?: string
          preview_url?: string | null
          project_name?: string
          qr_code_id?: string
          selected_formats?: Json
          show_business_name?: boolean
          show_google_badge?: boolean
          show_logo?: boolean
          show_stars?: boolean
          status?: string
          support_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_packs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_packs_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_plan_items: {
        Row: {
          business_id: string
          created_at: string
          cta_text: string | null
          destination_type: string
          destination_url: string | null
          failure_reason: string | null
          goal: string | null
          headline: string | null
          id: string
          implementation_status: string
          location_id: string | null
          material: string | null
          owner_id: string
          placement_key: string
          placement_name: string
          placement_plan_id: string
          priority: string
          qr_code_id: string | null
          recommended_format_id: string | null
          sort_order: number
          support_text: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          cta_text?: string | null
          destination_type?: string
          destination_url?: string | null
          failure_reason?: string | null
          goal?: string | null
          headline?: string | null
          id?: string
          implementation_status?: string
          location_id?: string | null
          material?: string | null
          owner_id: string
          placement_key: string
          placement_name: string
          placement_plan_id: string
          priority?: string
          qr_code_id?: string | null
          recommended_format_id?: string | null
          sort_order?: number
          support_text?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          cta_text?: string | null
          destination_type?: string
          destination_url?: string | null
          failure_reason?: string | null
          goal?: string | null
          headline?: string | null
          id?: string
          implementation_status?: string
          location_id?: string | null
          material?: string | null
          owner_id?: string
          placement_key?: string
          placement_name?: string
          placement_plan_id?: string
          priority?: string
          qr_code_id?: string | null
          recommended_format_id?: string | null
          sort_order?: number
          support_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_plan_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_plan_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_plan_items_placement_plan_id_fkey"
            columns: ["placement_plan_id"]
            isOneToOne: false
            referencedRelation: "placement_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_plan_items_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_plans: {
        Row: {
          business_id: string
          checklist: Json
          created_at: string
          generated_qr_ids: Json
          goals: Json
          id: string
          industry: string
          marketing_pack_id: string | null
          name: string
          owner_id: string
          recommendation_version: number
          selected_placements: Json
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          checklist?: Json
          created_at?: string
          generated_qr_ids?: Json
          goals?: Json
          id?: string
          industry: string
          marketing_pack_id?: string | null
          name: string
          owner_id: string
          recommendation_version?: number
          selected_placements?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          checklist?: Json
          created_at?: string
          generated_qr_ids?: Json
          goals?: Json
          id?: string
          industry?: string
          marketing_pack_id?: string | null
          name?: string
          owner_id?: string
          recommendation_version?: number
          selected_placements?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_plans_marketing_pack_id_fkey"
            columns: ["marketing_pack_id"]
            isOneToOne: false
            referencedRelation: "marketing_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      print_bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          label: string
          product_id: string
          quantity: number
          sort_order: number
          variant_id: string | null
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          label: string
          product_id: string
          quantity?: number
          sort_order?: number
          variant_id?: string | null
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          label?: string
          product_id?: string
          quantity?: number
          sort_order?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "print_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "print_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_bundle_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "print_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      print_bundles: {
        Row: {
          active: boolean
          bundle_key: string
          created_at: string
          description: string
          discount_percent: number
          id: string
          industry: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          bundle_key: string
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          industry?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          bundle_key?: string
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          industry?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      print_cart_items: {
        Row: {
          approved_at: string | null
          artwork_version: number
          bundle_group: string | null
          bundle_id: string | null
          business_id: string
          campaign: string | null
          cart_id: string
          created_at: string
          currency_code: string
          design: Json
          id: string
          marketing_pack_id: string | null
          owner_id: string
          placement_plan_id: string | null
          product_id: string
          proof_id: string | null
          qr_code_id: string
          quantity: number
          unit_cost_minor: number
          unit_retail_minor: number
          updated_at: string
          validation_snapshot: Json
          validation_status: string
          variant_id: string
          warnings_acknowledged: boolean
        }
        Insert: {
          approved_at?: string | null
          artwork_version?: number
          bundle_group?: string | null
          bundle_id?: string | null
          business_id: string
          campaign?: string | null
          cart_id: string
          created_at?: string
          currency_code?: string
          design?: Json
          id?: string
          marketing_pack_id?: string | null
          owner_id: string
          placement_plan_id?: string | null
          product_id: string
          proof_id?: string | null
          qr_code_id: string
          quantity?: number
          unit_cost_minor?: number
          unit_retail_minor?: number
          updated_at?: string
          validation_snapshot?: Json
          validation_status?: string
          variant_id: string
          warnings_acknowledged?: boolean
        }
        Update: {
          approved_at?: string | null
          artwork_version?: number
          bundle_group?: string | null
          bundle_id?: string | null
          business_id?: string
          campaign?: string | null
          cart_id?: string
          created_at?: string
          currency_code?: string
          design?: Json
          id?: string
          marketing_pack_id?: string | null
          owner_id?: string
          placement_plan_id?: string | null
          product_id?: string
          proof_id?: string | null
          qr_code_id?: string
          quantity?: number
          unit_cost_minor?: number
          unit_retail_minor?: number
          updated_at?: string
          validation_snapshot?: Json
          validation_status?: string
          variant_id?: string
          warnings_acknowledged?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "print_cart_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "print_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_cart_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "print_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_cart_items_marketing_pack_id_fkey"
            columns: ["marketing_pack_id"]
            isOneToOne: false
            referencedRelation: "marketing_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_cart_items_placement_plan_id_fkey"
            columns: ["placement_plan_id"]
            isOneToOne: false
            referencedRelation: "placement_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "print_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_cart_items_proof_fk"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "print_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_cart_items_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "print_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      print_carts: {
        Row: {
          created_at: string
          currency_code: string
          id: string
          owner_id: string
          pricing_region: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          id?: string
          owner_id: string
          pricing_region?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          id?: string
          owner_id?: string
          pricing_region?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      print_interest: {
        Row: {
          admin_notes: string | null
          business_id: string | null
          comments: string | null
          contact_consent: boolean
          country_code: string | null
          created_at: string
          desired_timeframe: string | null
          email: string
          expected_quantity: string | null
          id: string
          owner_id: string
          preferred_material: string | null
          preferred_size: string | null
          product_keys: Json
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          business_id?: string | null
          comments?: string | null
          contact_consent?: boolean
          country_code?: string | null
          created_at?: string
          desired_timeframe?: string | null
          email: string
          expected_quantity?: string | null
          id?: string
          owner_id: string
          preferred_material?: string | null
          preferred_size?: string | null
          product_keys?: Json
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          business_id?: string | null
          comments?: string | null
          contact_consent?: boolean
          country_code?: string | null
          created_at?: string
          desired_timeframe?: string | null
          email?: string
          expected_quantity?: string | null
          id?: string
          owner_id?: string
          preferred_material?: string | null
          preferred_size?: string | null
          product_keys?: Json
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_interest_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      print_order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          new_status: string | null
          note: string | null
          order_id: string
          owner_id: string
          previous_status: string | null
          visibility: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_status?: string | null
          note?: string | null
          order_id: string
          owner_id: string
          previous_status?: string | null
          visibility?: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_status?: string | null
          note?: string | null
          order_id?: string
          owner_id?: string
          previous_status?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "print_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      print_order_items: {
        Row: {
          artwork_version: number
          bundle_id: string | null
          business_id: string | null
          created_at: string
          design: Json
          id: string
          line_total_minor: number
          order_id: string
          owner_id: string
          product_id: string
          product_name: string
          proof_id: string | null
          qr_code_id: string | null
          qr_destination: string | null
          quantity: number
          unit_cost_minor: number
          unit_retail_minor: number
          validation_snapshot: Json
          variant_id: string
          variant_label: string
        }
        Insert: {
          artwork_version?: number
          bundle_id?: string | null
          business_id?: string | null
          created_at?: string
          design?: Json
          id?: string
          line_total_minor?: number
          order_id: string
          owner_id: string
          product_id: string
          product_name: string
          proof_id?: string | null
          qr_code_id?: string | null
          qr_destination?: string | null
          quantity?: number
          unit_cost_minor?: number
          unit_retail_minor?: number
          validation_snapshot?: Json
          variant_id: string
          variant_label?: string
        }
        Update: {
          artwork_version?: number
          bundle_id?: string | null
          business_id?: string | null
          created_at?: string
          design?: Json
          id?: string
          line_total_minor?: number
          order_id?: string
          owner_id?: string
          product_id?: string
          product_name?: string
          proof_id?: string | null
          qr_code_id?: string | null
          qr_destination?: string | null
          quantity?: number
          unit_cost_minor?: number
          unit_retail_minor?: number
          validation_snapshot?: Json
          variant_id?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_order_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "print_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_order_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "print_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "print_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_order_items_proof_fk"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "print_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_order_items_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "print_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      print_orders: {
        Row: {
          canceled_at: string | null
          contact_email: string | null
          created_at: string
          currency_code: string
          delivered_at: string | null
          discount_minor: number
          discount_percent: number
          environment: string
          estimated_cost_minor: number
          estimated_delivery_date: string | null
          estimated_margin_minor: number
          estimated_ship_date: string | null
          failure_reason: string | null
          id: string
          internal_notes: string | null
          order_number: string
          owner_id: string
          paid_at: string | null
          payment_status: string
          plan_key: string
          pricing_region: string
          printer_name: string | null
          provider_key: string
          provider_order_id: string | null
          refund_amount_minor: number | null
          refunded_at: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_minor: number
          shipping_name: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          submitted_at: string | null
          subtotal_minor: number
          supplier_cost_minor: number | null
          supplier_shipping_minor: number | null
          tax_minor: number
          total_minor: number
          tracking_carrier: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          contact_email?: string | null
          created_at?: string
          currency_code?: string
          delivered_at?: string | null
          discount_minor?: number
          discount_percent?: number
          environment?: string
          estimated_cost_minor?: number
          estimated_delivery_date?: string | null
          estimated_margin_minor?: number
          estimated_ship_date?: string | null
          failure_reason?: string | null
          id?: string
          internal_notes?: string | null
          order_number: string
          owner_id: string
          paid_at?: string | null
          payment_status?: string
          plan_key?: string
          pricing_region?: string
          printer_name?: string | null
          provider_key?: string
          provider_order_id?: string | null
          refund_amount_minor?: number | null
          refunded_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_minor?: number
          shipping_name?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          submitted_at?: string | null
          subtotal_minor?: number
          supplier_cost_minor?: number | null
          supplier_shipping_minor?: number | null
          tax_minor?: number
          total_minor?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          contact_email?: string | null
          created_at?: string
          currency_code?: string
          delivered_at?: string | null
          discount_minor?: number
          discount_percent?: number
          environment?: string
          estimated_cost_minor?: number
          estimated_delivery_date?: string | null
          estimated_margin_minor?: number
          estimated_ship_date?: string | null
          failure_reason?: string | null
          id?: string
          internal_notes?: string | null
          order_number?: string
          owner_id?: string
          paid_at?: string | null
          payment_status?: string
          plan_key?: string
          pricing_region?: string
          printer_name?: string | null
          provider_key?: string
          provider_order_id?: string | null
          refund_amount_minor?: number | null
          refunded_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_minor?: number
          shipping_name?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          submitted_at?: string | null
          subtotal_minor?: number
          supplier_cost_minor?: number | null
          supplier_shipping_minor?: number | null
          tax_minor?: number
          total_minor?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      print_product_variants: {
        Row: {
          active: boolean
          created_at: string
          currency_code: string
          fulfilment_cost_minor: number
          id: string
          label: string
          product_id: string
          quantity: number
          retail_price_minor: number
          sort_order: number
          updated_at: string
          variant_key: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency_code?: string
          fulfilment_cost_minor: number
          id?: string
          label: string
          product_id: string
          quantity: number
          retail_price_minor: number
          sort_order?: number
          updated_at?: string
          variant_key: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency_code?: string
          fulfilment_cost_minor?: number
          id?: string
          label?: string
          product_id?: string
          quantity?: number
          retail_price_minor?: number
          sort_order?: number
          updated_at?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "print_products"
            referencedColumns: ["id"]
          },
        ]
      }
      print_products: {
        Row: {
          active: boolean
          artwork_format: string
          base_currency: string
          bleed_mm: number
          category: string
          created_at: string
          description: string
          finish: string
          format_id: string | null
          height_mm: number
          id: string
          material: string
          min_qr_mm: number
          name: string
          print_sides: number
          product_key: string
          production_days_max: number
          production_days_min: number
          safe_area_mm: number
          shape: string
          shipping_class: string
          slug: string
          sort_order: number
          supported_countries: string[]
          updated_at: string
          width_mm: number
        }
        Insert: {
          active?: boolean
          artwork_format?: string
          base_currency?: string
          bleed_mm?: number
          category?: string
          created_at?: string
          description?: string
          finish?: string
          format_id?: string | null
          height_mm: number
          id?: string
          material?: string
          min_qr_mm?: number
          name: string
          print_sides?: number
          product_key: string
          production_days_max?: number
          production_days_min?: number
          safe_area_mm?: number
          shape?: string
          shipping_class?: string
          slug: string
          sort_order?: number
          supported_countries?: string[]
          updated_at?: string
          width_mm: number
        }
        Update: {
          active?: boolean
          artwork_format?: string
          base_currency?: string
          bleed_mm?: number
          category?: string
          created_at?: string
          description?: string
          finish?: string
          format_id?: string | null
          height_mm?: number
          id?: string
          material?: string
          min_qr_mm?: number
          name?: string
          print_sides?: number
          product_key?: string
          production_days_max?: number
          production_days_min?: number
          safe_area_mm?: number
          shape?: string
          shipping_class?: string
          slug?: string
          sort_order?: number
          supported_countries?: string[]
          updated_at?: string
          width_mm?: number
        }
        Relationships: []
      }
      print_proofs: {
        Row: {
          approval_statement: string | null
          approved_at: string | null
          approved_by: string | null
          artwork_hash: string
          back_svg: string | null
          business_id: string | null
          cart_item_id: string | null
          created_at: string
          design_snapshot: Json
          front_svg: string | null
          id: string
          order_item_id: string | null
          owner_id: string
          product_id: string
          proof_url: string | null
          qr_code_id: string | null
          qr_destination: string | null
          qr_short_url: string | null
          status: string
          updated_at: string
          validation_snapshot: Json
          version: number
        }
        Insert: {
          approval_statement?: string | null
          approved_at?: string | null
          approved_by?: string | null
          artwork_hash?: string
          back_svg?: string | null
          business_id?: string | null
          cart_item_id?: string | null
          created_at?: string
          design_snapshot?: Json
          front_svg?: string | null
          id?: string
          order_item_id?: string | null
          owner_id: string
          product_id: string
          proof_url?: string | null
          qr_code_id?: string | null
          qr_destination?: string | null
          qr_short_url?: string | null
          status?: string
          updated_at?: string
          validation_snapshot?: Json
          version?: number
        }
        Update: {
          approval_statement?: string | null
          approved_at?: string | null
          approved_by?: string | null
          artwork_hash?: string
          back_svg?: string | null
          business_id?: string | null
          cart_item_id?: string | null
          created_at?: string
          design_snapshot?: Json
          front_svg?: string | null
          id?: string
          order_item_id?: string | null
          owner_id?: string
          product_id?: string
          proof_url?: string | null
          qr_code_id?: string | null
          qr_destination?: string | null
          qr_short_url?: string | null
          status?: string
          updated_at?: string
          validation_snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_proofs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_proofs_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: false
            referencedRelation: "print_cart_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_proofs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "print_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_proofs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "print_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_proofs_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          owner_id: string | null
          path: string | null
          properties: Json
          session_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          owner_id?: string | null
          path?: string | null
          properties?: Json
          session_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          owner_id?: string | null
          path?: string | null
          properties?: Json
          session_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          language: string | null
          plan_primary_business_id: string | null
          plan_primary_qr_id: string | null
          registration_country_code: string | null
          registration_country_recorded_at: string | null
          registration_country_source: string | null
          subscription_tier: string | null
          theme: string | null
          timezone: string | null
          updated_at: string
          upgrade_checklist_dismissed_at: string | null
          upgrade_welcome_email_sent_at: string | null
          upgrade_welcome_plan_key: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          plan_primary_business_id?: string | null
          plan_primary_qr_id?: string | null
          registration_country_code?: string | null
          registration_country_recorded_at?: string | null
          registration_country_source?: string | null
          subscription_tier?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          upgrade_checklist_dismissed_at?: string | null
          upgrade_welcome_email_sent_at?: string | null
          upgrade_welcome_plan_key?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          plan_primary_business_id?: string | null
          plan_primary_qr_id?: string | null
          registration_country_code?: string | null
          registration_country_recorded_at?: string | null
          registration_country_source?: string | null
          subscription_tier?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          upgrade_checklist_dismissed_at?: string | null
          upgrade_welcome_email_sent_at?: string | null
          upgrade_welcome_plan_key?: string | null
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          archived_at: string | null
          bg_color: string | null
          business_goal: string | null
          business_id: string
          campaign: string | null
          created_at: string
          cta_text: string | null
          design: Json
          destination_label: string | null
          destination_type: string
          destination_url: string | null
          expires_at: string | null
          fg_color: string | null
          format_customizations: Json
          format_last_edited_at: string | null
          headline: string | null
          id: string
          label: string | null
          landing_mode: string
          layout_template: string
          location_id: string | null
          logo_url: string | null
          owner_id: string
          placement_key: string | null
          placement_plan_id: string | null
          placement_plan_item_id: string | null
          project_name: string | null
          scans_count: number
          selected_formats: Json
          short_code: string
          status: string
          style: string | null
          support_text: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          bg_color?: string | null
          business_goal?: string | null
          business_id: string
          campaign?: string | null
          created_at?: string
          cta_text?: string | null
          design?: Json
          destination_label?: string | null
          destination_type?: string
          destination_url?: string | null
          expires_at?: string | null
          fg_color?: string | null
          format_customizations?: Json
          format_last_edited_at?: string | null
          headline?: string | null
          id?: string
          label?: string | null
          landing_mode?: string
          layout_template?: string
          location_id?: string | null
          logo_url?: string | null
          owner_id: string
          placement_key?: string | null
          placement_plan_id?: string | null
          placement_plan_item_id?: string | null
          project_name?: string | null
          scans_count?: number
          selected_formats?: Json
          short_code: string
          status?: string
          style?: string | null
          support_text?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          bg_color?: string | null
          business_goal?: string | null
          business_id?: string
          campaign?: string | null
          created_at?: string
          cta_text?: string | null
          design?: Json
          destination_label?: string | null
          destination_type?: string
          destination_url?: string | null
          expires_at?: string | null
          fg_color?: string | null
          format_customizations?: Json
          format_last_edited_at?: string | null
          headline?: string | null
          id?: string
          label?: string | null
          landing_mode?: string
          layout_template?: string
          location_id?: string | null
          logo_url?: string | null
          owner_id?: string
          placement_key?: string | null
          placement_plan_id?: string | null
          placement_plan_item_id?: string | null
          project_name?: string | null
          scans_count?: number
          selected_formats?: Json
          short_code?: string
          status?: string
          style?: string | null
          support_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_placement_plan_id_fkey"
            columns: ["placement_plan_id"]
            isOneToOne: false
            referencedRelation: "placement_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_placement_plan_item_id_fkey"
            columns: ["placement_plan_item_id"]
            isOneToOne: false
            referencedRelation: "placement_plan_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_actions: {
        Row: {
          action: string
          business_id: string | null
          created_at: string
          id: string
          note: string | null
          owner_id: string
          recommendation_key: string
          snooze_until: string | null
          updated_at: string
        }
        Insert: {
          action: string
          business_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          owner_id: string
          recommendation_key: string
          snooze_until?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          business_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          recommendation_key?: string
          snooze_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_actions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      region_correction_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          current_country_code: string | null
          id: string
          owner_id: string
          reason: string
          requested_country_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          supporting_information: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          current_country_code?: string | null
          id?: string
          owner_id: string
          reason: string
          requested_country_code: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supporting_information?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          current_country_code?: string | null
          id?: string
          owner_id?: string
          reason?: string
          requested_country_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supporting_information?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      regional_plan_prices: {
        Row: {
          active: boolean
          amount_minor: number
          billing_interval: string
          created_at: string
          currency_code: string
          environment: string
          id: string
          plan_key: string
          pricing_region: string
          stripe_lookup_key: string
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_minor: number
          billing_interval: string
          created_at?: string
          currency_code: string
          environment: string
          id?: string
          plan_key: string
          pricing_region: string
          stripe_lookup_key: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_minor?: number
          billing_interval?: string
          created_at?: string
          currency_code?: string
          environment?: string
          id?: string
          plan_key?: string
          pricing_region?: string
          stripe_lookup_key?: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scan_events: {
        Row: {
          browser: string | null
          business_id: string
          campaign: string | null
          clicked_review: boolean
          clicked_review_at: string | null
          country: string | null
          country_code: string | null
          country_name: string | null
          created_at: string
          destination_clicked: boolean
          destination_clicked_at: string | null
          destination_type: string | null
          device_type: string | null
          id: string
          location_id: string | null
          os: string | null
          owner_id: string
          qr_code_id: string
          referrer: string | null
          region: string | null
          session_id: string | null
          timezone: string | null
          updated_at: string
          user_agent: string | null
          visitor_hash: string | null
        }
        Insert: {
          browser?: string | null
          business_id: string
          campaign?: string | null
          clicked_review?: boolean
          clicked_review_at?: string | null
          country?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          destination_clicked?: boolean
          destination_clicked_at?: string | null
          destination_type?: string | null
          device_type?: string | null
          id?: string
          location_id?: string | null
          os?: string | null
          owner_id: string
          qr_code_id: string
          referrer?: string | null
          region?: string | null
          session_id?: string | null
          timezone?: string | null
          updated_at?: string
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Update: {
          browser?: string | null
          business_id?: string
          campaign?: string | null
          clicked_review?: boolean
          clicked_review_at?: string | null
          country?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          destination_clicked?: boolean
          destination_clicked_at?: string | null
          destination_type?: string | null
          device_type?: string | null
          id?: string
          location_id?: string | null
          os?: string | null
          owner_id?: string
          qr_code_id?: string
          referrer?: string | null
          region?: string | null
          session_id?: string | null
          timezone?: string | null
          updated_at?: string
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_events_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          environment: string
          error_message: string | null
          event_type: string
          id: string
          last_attempt_at: string | null
          livemode: boolean
          processed_at: string | null
          processing_status: string
          received_at: string
          retry_count: number
          stripe_event_id: string
        }
        Insert: {
          environment?: string
          error_message?: string | null
          event_type: string
          id?: string
          last_attempt_at?: string | null
          livemode?: boolean
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          retry_count?: number
          stripe_event_id: string
        }
        Update: {
          environment?: string
          error_message?: string | null
          event_type?: string
          id?: string
          last_attempt_at?: string | null
          livemode?: boolean
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          retry_count?: number
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_minor: number | null
          billing_interval: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          currency_code: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          last_invoice_id: string | null
          last_payment_status: string | null
          owner_id: string
          plan_key: string
          pricing_region: string | null
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          amount_minor?: number | null
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency_code?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          last_invoice_id?: string | null
          last_payment_status?: string | null
          owner_id: string
          plan_key?: string
          pricing_region?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          amount_minor?: number | null
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency_code?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          last_invoice_id?: string | null
          last_payment_status?: string | null
          owner_id?: string
          plan_key?: string
          pricing_region?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_ai_insight_feedback: {
        Row: {
          comment: string | null
          created_at: string
          helpful: boolean
          id: string
          insight_id: string
          owner_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          helpful: boolean
          id?: string
          insight_id: string
          owner_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          helpful?: boolean
          id?: string
          insight_id?: string
          owner_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_ai_insight_feedback_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "weekly_ai_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_ai_insights: {
        Row: {
          business_id: string
          created_at: string
          error_message: string | null
          generated_at: string | null
          generated_output: Json | null
          generation_status: string
          health_score_id: string | null
          id: string
          input_payload: Json
          model: string | null
          owner_id: string
          period_end: string
          period_start: string
          provider: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          generated_output?: Json | null
          generation_status?: string
          health_score_id?: string | null
          id?: string
          input_payload?: Json
          model?: string | null
          owner_id: string
          period_end: string
          period_start: string
          provider?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          error_message?: string | null
          generated_at?: string | null
          generated_output?: Json | null
          generation_status?: string
          health_score_id?: string | null
          id?: string
          input_payload?: Json
          model?: string | null
          owner_id?: string
          period_end?: string
          period_start?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_ai_insights_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_beta_health: { Args: { _since?: string }; Returns: Json }
      admin_conversion_funnel: {
        Args: { _since?: string }
        Returns: {
          accounts: number
          step: string
          step_order: number
        }[]
      }
      admin_founder_stats: { Args: never; Returns: Json }
      allocate_founder_slot: {
        Args: {
          p_billing_interval: string
          p_environment?: string
          p_founder_price_id?: string
          p_owner_id: string
          p_pricing_region: string
          p_stripe_customer_id?: string
          p_stripe_event_id?: string
          p_stripe_subscription_id?: string
        }
        Returns: number
      }
      claim_stripe_webhook_event: {
        Args: {
          p_environment: string
          p_event_id: string
          p_event_type: string
          p_livemode: boolean
        }
        Returns: string
      }
      effective_plan_key: { Args: { _owner_id: string }; Returns: string }
      finish_stripe_webhook_event: {
        Args: { p_error?: string; p_event_id: string; p_status: string }
        Returns: undefined
      }
      founder_slots_remaining: { Args: never; Returns: number }
      has_paid_access: {
        Args: { _environment?: string; _owner_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_qr_scans: { Args: { p_qr_id: string }; Returns: undefined }
      log_scan_redirect: {
        Args: {
          p_browser?: string
          p_clicked?: boolean
          p_country_code?: string
          p_destination_type?: string
          p_device_type?: string
          p_os?: string
          p_qr_id: string
          p_referrer?: string
          p_session_id?: string
          p_user_agent?: string
          p_visitor_hash?: string
        }
        Returns: string
      }
      mark_scan_clicked: {
        Args: {
          p_event_id: string
          p_is_review?: boolean
          p_session_id: string
        }
        Returns: boolean
      }
      my_founder_status: { Args: never; Returns: Json }
      my_onboarding_progress: { Args: never; Returns: Json }
      next_print_order_number: { Args: never; Returns: string }
      release_founder_slot: {
        Args: {
          p_actor_id?: string
          p_owner_id: string
          p_reason?: string
          p_source?: string
          p_status: string
          p_stripe_event_id?: string
        }
        Returns: boolean
      }
      restore_founder_slot: {
        Args: { p_actor_id?: string; p_owner_id: string; p_reason?: string }
        Returns: number
      }
      suppress_email: {
        Args: {
          p_email: string
          p_owner_id: string
          p_reason: string
          p_scope?: string
          p_source: string
        }
        Returns: undefined
      }
      weekly_reports_due: {
        Args: { p_now?: string }
        Returns: {
          business_ids: Json
          local_now: string
          owner_id: string
          report_format: string
          timezone: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
