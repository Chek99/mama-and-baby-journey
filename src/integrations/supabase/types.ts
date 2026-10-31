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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string | null
          at: string
          device: string | null
          entity_id: string | null
          entity_type: string | null
          facility_id: string | null
          id: number
          ip: string | null
          metadata: Json
          success: boolean
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id?: string | null
          at?: string
          device?: string | null
          entity_id?: string | null
          entity_type?: string | null
          facility_id?: string | null
          id?: never
          ip?: string | null
          metadata?: Json
          success?: boolean
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string | null
          at?: string
          device?: string | null
          entity_id?: string | null
          entity_type?: string | null
          facility_id?: string | null
          id?: never
          ip?: string | null
          metadata?: Json
          success?: boolean
        }
        Relationships: []
      }
      backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      facilities: {
        Row: {
          address: string | null
          county: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          mfl_code: string | null
          name: string
          phone: string | null
          services: string[]
          sub_county: string | null
          updated_at: string
          ward: string | null
        }
        Insert: {
          address?: string | null
          county: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          mfl_code?: string | null
          name: string
          phone?: string | null
          services?: string[]
          sub_county?: string | null
          updated_at?: string
          ward?: string | null
        }
        Update: {
          address?: string | null
          county?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          mfl_code?: string | null
          name?: string
          phone?: string | null
          services?: string[]
          sub_county?: string | null
          updated_at?: string
          ward?: string | null
        }
        Relationships: []
      }
      login_challenges: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          last_sent_at: string
          purpose: string
          remember_device: boolean
          resend_count: number
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          last_sent_at?: string
          purpose?: string
          remember_device?: boolean
          resend_count?: number
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          last_sent_at?: string
          purpose?: string
          remember_device?: boolean
          resend_count?: number
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string
          hash: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activated_at: string | null
          cadre: string | null
          created_at: string
          created_by: string | null
          email: string | null
          facility_id: string | null
          full_name: string
          id: string
          is_active: boolean
          language: string
          licence_number: string | null
          must_change_password: boolean
          phone: string | null
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          cadre?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          facility_id?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          language?: string
          licence_number?: string | null
          must_change_password?: boolean
          phone?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          cadre?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          facility_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          language?: string
          licence_number?: string | null
          must_change_password?: boolean
          phone?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          locked_until: string | null
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          locked_until?: string | null
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          locked_until?: string | null
          window_start?: string
        }
        Relationships: []
      }
      sms_log: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          facility_id: string | null
          id: string
          phone_hash: string
          provider: string
          provider_message_id: string | null
          purpose: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          facility_id?: string | null
          id?: string
          phone_hash: string
          provider: string
          provider_message_id?: string | null
          purpose: string
          status: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          facility_id?: string | null
          id?: string
          phone_hash?: string
          provider?: string
          provider_message_id?: string | null
          purpose?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_otps: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          last_sent_at: string
          phone_hash: string
          purpose: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          last_sent_at?: string
          phone_hash: string
          purpose: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_sent_at?: string
          phone_hash?: string
          purpose?: string
          used_at?: string | null
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string
          device: string | null
          expires_at: string
          id: string
          last_used_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device?: string | null
          expires_at: string
          id?: string
          last_used_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device?: string | null
          expires_at?: string
          id?: string
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          facility_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          ward: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          facility_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          ward?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          facility_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_sessions: {
        Row: {
          created_at: string
          device: string | null
          expires_at: string
          ip: string | null
          method: string
          revoked_at: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device?: string | null
          expires_at: string
          ip?: string | null
          method: string
          revoked_at?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          device?: string | null
          expires_at?: string
          ip?: string | null
          method?: string
          revoked_at?: string | null
          session_id?: string
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
      is_session_verified: { Args: never; Returns: boolean }
      my_facility_id: { Args: never; Returns: string }
      rate_limit_hit: {
        Args: {
          _key: string
          _lock_seconds: number
          _max: number
          _window_seconds: number
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "system_admin"
        | "hospital_admin"
        | "clinician"
        | "chv"
        | "mother"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "system_admin",
        "hospital_admin",
        "clinician",
        "chv",
        "mother",
      ],
    },
  },
} as const
