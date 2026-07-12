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
      businesses: {
        Row: {
          address: string | null
          brand_primary: string | null
          brand_secondary: string | null
          cover_image_url: string | null
          created_at: string
          google_review_url: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          status: string
          updated_at: string
          website: string | null
          welcome_message: string | null
        }
        Insert: {
          address?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          cover_image_url?: string | null
          created_at?: string
          google_review_url?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          welcome_message?: string | null
        }
        Update: {
          address?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          cover_image_url?: string | null
          created_at?: string
          google_review_url?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          language: string | null
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
          subscription_tier?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          bg_color: string | null
          business_id: string
          campaign: string | null
          created_at: string
          fg_color: string | null
          id: string
          label: string | null
          location_id: string | null
          logo_url: string | null
          owner_id: string
          scans_count: number
          short_code: string
          status: string
          style: string | null
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          business_id: string
          campaign?: string | null
          created_at?: string
          fg_color?: string | null
          id?: string
          label?: string | null
          location_id?: string | null
          logo_url?: string | null
          owner_id: string
          scans_count?: number
          short_code: string
          status?: string
          style?: string | null
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          business_id?: string
          campaign?: string | null
          created_at?: string
          fg_color?: string | null
          id?: string
          label?: string | null
          location_id?: string | null
          logo_url?: string | null
          owner_id?: string
          scans_count?: number
          short_code?: string
          status?: string
          style?: string | null
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
      mark_scan_clicked: { Args: { p_event_id: string }; Returns: undefined }
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
