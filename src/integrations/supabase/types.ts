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
      draft_teams: {
        Row: {
          color: string
          created_at: string
          draft_id: string
          id: string
          manager: string | null
          name: string
          slot: number
        }
        Insert: {
          color?: string
          created_at?: string
          draft_id: string
          id?: string
          manager?: string | null
          name: string
          slot: number
        }
        Update: {
          color?: string
          created_at?: string
          draft_id?: string
          id?: string
          manager?: string | null
          name?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_teams_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          clock_seconds: number
          created_at: string
          current_overall: number
          id: string
          league_name: string
          order_type: string
          room_code: string
          rounds: number
          status: string
          team_count: number
          updated_at: string
        }
        Insert: {
          clock_seconds?: number
          created_at?: string
          current_overall?: number
          id?: string
          league_name: string
          order_type?: string
          room_code: string
          rounds: number
          status?: string
          team_count: number
          updated_at?: string
        }
        Update: {
          clock_seconds?: number
          created_at?: string
          current_overall?: number
          id?: string
          league_name?: string
          order_type?: string
          room_code?: string
          rounds?: number
          status?: string
          team_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      highlights: {
        Row: {
          created_at: string
          player_id: string
          source: string | null
          summary: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          player_id: string
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          player_id?: string
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "highlights_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      picks: {
        Row: {
          created_at: string
          draft_id: string
          id: string
          overall: number
          pick_in_round: number
          player_id: string
          round: number
          team_id: string
        }
        Insert: {
          created_at?: string
          draft_id: string
          id?: string
          overall: number
          pick_in_round: number
          player_id: string
          round: number
          team_id: string
        }
        Update: {
          created_at?: string
          draft_id?: string
          id?: string
          overall?: number
          pick_in_round?: number
          player_id?: string
          round?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picks_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "draft_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_media: {
        Row: {
          action_url: string | null
          created_at: string
          headshot_url: string | null
          player_id: string
          source: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          headshot_url?: string | null
          player_id: string
          source?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string
          headshot_url?: string | null
          player_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_media_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          adp: number | null
          bye_week: number | null
          created_at: string
          id: string
          name: string
          nfl_team: string
          position: string
          rank: number
          stat_line: string | null
        }
        Insert: {
          adp?: number | null
          bye_week?: number | null
          created_at?: string
          id?: string
          name: string
          nfl_team: string
          position: string
          rank: number
          stat_line?: string | null
        }
        Update: {
          adp?: number | null
          bye_week?: number | null
          created_at?: string
          id?: string
          name?: string
          nfl_team?: string
          position?: string
          rank?: number
          stat_line?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
