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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          code: string
          description: string
          icon: string | null
          name: string
        }
        Insert: {
          code: string
          description: string
          icon?: string | null
          name: string
        }
        Update: {
          code?: string
          description?: string
          icon?: string | null
          name?: string
        }
        Relationships: []
      }
      care_schedules: {
        Row: {
          created_at: string
          id: string
          interval_days: number
          is_paused: boolean
          last_done_at: string | null
          next_due_at: string
          notes: string | null
          plant_id: string
          task_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_days: number
          is_paused?: boolean
          last_done_at?: string | null
          next_due_at?: string
          notes?: string | null
          plant_id: string
          task_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_days?: number
          is_paused?: boolean
          last_done_at?: string | null
          next_due_at?: string
          notes?: string | null
          plant_id?: string
          task_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_schedules_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      community_notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          post_id: string
          read_at: string | null
          recipient_id: string
          type: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id: string
          read_at?: string | null
          recipient_id: string
          type: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string
          read_at?: string | null
          recipient_id?: string
          type?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          plant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          plant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          plant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diagnosis_history: {
        Row: {
          care_recommendations: Json | null
          created_at: string
          diseases: Json | null
          id: string
          image_url: string | null
          is_healthy: boolean
          overall_confidence: number | null
          plant_id: string
          user_id: string
        }
        Insert: {
          care_recommendations?: Json | null
          created_at?: string
          diseases?: Json | null
          id?: string
          image_url?: string | null
          is_healthy?: boolean
          overall_confidence?: number | null
          plant_id: string
          user_id: string
        }
        Update: {
          care_recommendations?: Json | null
          created_at?: string
          diseases?: Json | null
          id?: string
          image_url?: string | null
          is_healthy?: boolean
          overall_confidence?: number | null
          plant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_history_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          image_url: string | null
          mood: string | null
          observation: string | null
          plant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          id?: string
          image_url?: string | null
          mood?: string | null
          observation?: string | null
          plant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          image_url?: string | null
          mood?: string | null
          observation?: string | null
          plant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          plant_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          plant_id: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          plant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_photos_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          care_tips: string | null
          confidence: number | null
          created_at: string
          id: string
          image_url: string | null
          is_public: boolean
          last_light_at: string | null
          last_light_lux: number | null
          last_light_reading: string | null
          last_watered: string | null
          light_requirement: string | null
          location: string | null
          name: string
          nickname: string | null
          notes: string | null
          pot_size: string | null
          scientific_name: string | null
          shared_garden_id: string | null
          sunlight: string | null
          updated_at: string
          user_id: string
          watering_frequency: string | null
        }
        Insert: {
          care_tips?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_public?: boolean
          last_light_at?: string | null
          last_light_lux?: number | null
          last_light_reading?: string | null
          last_watered?: string | null
          light_requirement?: string | null
          location?: string | null
          name: string
          nickname?: string | null
          notes?: string | null
          pot_size?: string | null
          scientific_name?: string | null
          shared_garden_id?: string | null
          sunlight?: string | null
          updated_at?: string
          user_id: string
          watering_frequency?: string | null
        }
        Update: {
          care_tips?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_public?: boolean
          last_light_at?: string | null
          last_light_lux?: number | null
          last_light_reading?: string | null
          last_watered?: string | null
          light_requirement?: string | null
          location?: string | null
          name?: string
          nickname?: string | null
          notes?: string | null
          pot_size?: string | null
          scientific_name?: string | null
          shared_garden_id?: string | null
          sunlight?: string | null
          updated_at?: string
          user_id?: string
          watering_frequency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plants_shared_garden_id_fkey"
            columns: ["shared_garden_id"]
            isOneToOne: false
            referencedRelation: "shared_gardens"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          comment_id: string | null
          created_at: string
          details: string | null
          id: string
          post_id: string | null
          reason: string
          reporter_id: string
          status: string
          target_type: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          reason: string
          reporter_id: string
          status?: string
          target_type: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          reason?: string
          reporter_id?: string
          status?: string
          target_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_streak: number
          display_name: string | null
          garden_bio: string | null
          id: string
          last_care_date: string | null
          longest_streak: number
          onboarded_at: string | null
          unit_system: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          garden_bio?: string | null
          id?: string
          last_care_date?: string | null
          longest_streak?: number
          onboarded_at?: string | null
          unit_system?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          garden_bio?: string | null
          id?: string
          last_care_date?: string | null
          longest_streak?: number
          onboarded_at?: string | null
          unit_system?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          last_sent_date: string | null
          p256dh: string | null
          reminder_time: string
          timezone: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          last_sent_date?: string | null
          p256dh?: string | null
          reminder_time?: string
          timezone?: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          last_sent_date?: string | null
          p256dh?: string | null
          reminder_time?: string
          timezone?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_garden_members: {
        Row: {
          garden_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          garden_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          garden_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_garden_members_garden_id_fkey"
            columns: ["garden_id"]
            isOneToOne: false
            referencedRelation: "shared_gardens"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_gardens: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_code: string
          earned_at: string
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      garden_owner: { Args: { _garden: string }; Returns: string }
      get_cron_watering_secret: { Args: never; Returns: string }
      grant_badge: {
        Args: { _code: string; _user: string }
        Returns: undefined
      }
      is_garden_member: {
        Args: { _garden: string; _user: string }
        Returns: boolean
      }
      join_shared_garden: { Args: { _code: string }; Returns: string }
      record_care_action: { Args: { _plant: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
