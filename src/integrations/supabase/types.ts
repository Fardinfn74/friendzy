export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  public: {
    Tables: {
      game_players: {
        Row: {
          card_seen: boolean;
          game_id: string;
          id: string;
          is_eliminated: boolean;
          is_host: boolean;
          is_imposter: boolean;
          is_ready: boolean;
          joined_at: string;
          last_seen_at: string;
          left_game: boolean;
          profile_id: string;
          turn_order: number | null;
        };
        Insert: {
          card_seen?: boolean;
          game_id: string;
          id?: string;
          is_eliminated?: boolean;
          is_host?: boolean;
          is_imposter?: boolean;
          is_ready?: boolean;
          joined_at?: string;
          last_seen_at?: string;
          left_game?: boolean;
          profile_id: string;
          turn_order?: number | null;
        };
        Update: {
          card_seen?: boolean;
          game_id?: string;
          id?: string;
          is_eliminated?: boolean;
          is_host?: boolean;
          is_imposter?: boolean;
          is_ready?: boolean;
          joined_at?: string;
          last_seen_at?: string;
          left_game?: boolean;
          profile_id?: string;
          turn_order?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_players_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          ai_category: string | null;
          ai_theme: string | null;
          ai_word: string | null;
          category: string | null;
          code: string;
          created_at: string;
          current_turn_profile_id: string | null;
          decoy_word: string | null;
          difficulty: string;
          game_mode: string;
          host_id: string;
          id: string;
          imposter_count: number;
          last_eliminated_id: string | null;
          last_eliminated_was_imposter: boolean | null;
          last_resolution_note: string | null;
          max_players: number;
          pending_status: string | null;
          replay_streak: number;
          resolve_until: string | null;
          round_number: number;
          secret_word: string | null;
          status: string;
          turn_deadline: string | null;
          updated_at: string;
          vote_deadline: string | null;
          winner: string | null;
        };
        Insert: {
          ai_category?: string | null;
          ai_theme?: string | null;
          ai_word?: string | null;
          category?: string | null;
          code: string;
          created_at?: string;
          current_turn_profile_id?: string | null;
          decoy_word?: string | null;
          difficulty?: string;
          game_mode?: string;
          host_id: string;
          id?: string;
          imposter_count?: number;
          last_eliminated_id?: string | null;
          last_eliminated_was_imposter?: boolean | null;
          last_resolution_note?: string | null;
          max_players?: number;
          pending_status?: string | null;
          replay_streak?: number;
          resolve_until?: string | null;
          round_number?: number;
          secret_word?: string | null;
          status?: string;
          turn_deadline?: string | null;
          updated_at?: string;
          vote_deadline?: string | null;
          winner?: string | null;
        };
        Update: {
          ai_category?: string | null;
          ai_theme?: string | null;
          ai_word?: string | null;
          category?: string | null;
          code?: string;
          created_at?: string;
          current_turn_profile_id?: string | null;
          decoy_word?: string | null;
          difficulty?: string;
          game_mode?: string;
          host_id?: string;
          id?: string;
          imposter_count?: number;
          last_eliminated_id?: string | null;
          last_eliminated_was_imposter?: boolean | null;
          last_resolution_note?: string | null;
          max_players?: number;
          pending_status?: string | null;
          replay_streak?: number;
          resolve_until?: string | null;
          round_number?: number;
          secret_word?: string | null;
          status?: string;
          turn_deadline?: string | null;
          updated_at?: string;
          vote_deadline?: string | null;
          winner?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_current_turn_profile_id_fkey";
            columns: ["current_turn_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_last_eliminated_id_fkey";
            columns: ["last_eliminated_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      hints: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          message: string;
          profile_id: string;
          round_number: number;
          skipped: boolean;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          message: string;
          profile_id: string;
          round_number: number;
          skipped?: boolean;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          message?: string;
          profile_id?: string;
          round_number?: number;
          skipped?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "hints_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hints_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      owned_items: {
        Row: {
          bought_at: string;
          item_id: string;
          user_id: string;
        };
        Insert: {
          bought_at?: string;
          item_id: string;
          user_id: string;
        };
        Update: {
          bought_at?: string;
          item_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      player_accounts: {
        Row: {
          coins: number;
          created_at: string;
          display_name: string;
          equipped_skin: string;
          user_id: string;
          username: string;
        };
        Insert: {
          coins?: number;
          created_at?: string;
          display_name: string;
          equipped_skin?: string;
          user_id: string;
          username: string;
        };
        Update: {
          coins?: number;
          created_at?: string;
          display_name?: string;
          equipped_skin?: string;
          user_id?: string;
          username?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_id: string;
          created_at: string;
          display_name: string;
          id: string;
          last_seen_at: string;
          session_token: string;
        };
        Insert: {
          avatar_id?: string;
          created_at?: string;
          display_name: string;
          id?: string;
          last_seen_at?: string;
          session_token: string;
        };
        Update: {
          avatar_id?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          last_seen_at?: string;
          session_token?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          is_replay_vote: boolean;
          round_number: number;
          target_id: string | null;
          voter_id: string;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          is_replay_vote?: boolean;
          round_number: number;
          target_id?: string | null;
          voter_id: string;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          is_replay_vote?: boolean;
          round_number?: number;
          target_id?: string | null;
          voter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "votes_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_voter_id_fkey";
            columns: ["voter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      word_bank: {
        Row: {
          category: string;
          difficulty: string;
          id: string;
          word: string;
        };
        Insert: {
          category: string;
          difficulty: string;
          id?: string;
          word: string;
        };
        Update: {
          category?: string;
          difficulty?: string;
          id?: string;
          word?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      buy_item: {
        Args: { _item: string; _price: number; _user: string };
        Returns: number;
      };
      rpc_get_profile: {
        Args: { p_session_token: string };
        Returns: { id: string; display_name: string; avatar_id: string }[];
      };
      rpc_touch_profile: {
        Args: { p_profile_id: string };
        Returns: undefined;
      };
      rpc_upsert_profile: {
        Args: { p_avatar_id: string; p_display_name: string; p_session_token: string };
        Returns: { id: string; display_name: string; avatar_id: string }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
