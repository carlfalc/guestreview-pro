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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          language: string | null
          registration_country_code: string | null
          registration_country_recorded_at: string | null
          registration_country_source: string | null
          subscription_tier: string | null
          theme: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          registration_country_code?: string | null
          registration_country_recorded_at?: string | null
          registration_country_source?: string | null
          subscription_tier?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          registration_country_code?: string | null
          registration_country_recorded_at?: string | null
          registration_country_source?: string | null
          subscription_tier?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          archived_at: string | null
          bg_color: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_qr_scans: { Args: { p_qr_id: string }; Returns: undefined }
      mark_scan_clicked: {
        Args: {
          p_event_id: string
          p_is_review?: boolean
          p_session_id: string
        }
        Returns: boolean
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
