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
      ai_summaries: {
        Row: {
          bullet_points: Json | null
          categories: Json | null
          confidence: number | null
          created_at: string
          detailed_summary: string | null
          entities: Json | null
          id: string
          model: string | null
          short_summary: string | null
          state_id: string | null
          subject_id: string
          subject_type: string
          summary: string
          topics: Json | null
          updated_at: string
        }
        Insert: {
          bullet_points?: Json | null
          categories?: Json | null
          confidence?: number | null
          created_at?: string
          detailed_summary?: string | null
          entities?: Json | null
          id?: string
          model?: string | null
          short_summary?: string | null
          state_id?: string | null
          subject_id: string
          subject_type: string
          summary: string
          topics?: Json | null
          updated_at?: string
        }
        Update: {
          bullet_points?: Json | null
          categories?: Json | null
          confidence?: number | null
          created_at?: string
          detailed_summary?: string | null
          entities?: Json | null
          id?: string
          model?: string | null
          short_summary?: string | null
          state_id?: string | null
          subject_id?: string
          subject_type?: string
          summary?: string
          topics?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      article_clusters: {
        Row: {
          article_count: number
          canonical_article_id: string | null
          category: string | null
          created_at: string
          first_seen_at: string | null
          id: string
          image_url: string | null
          last_seen_at: string | null
          state_id: string | null
          summary: string | null
          title: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          article_count?: number
          canonical_article_id?: string | null
          category?: string | null
          created_at?: string
          first_seen_at?: string | null
          id?: string
          image_url?: string | null
          last_seen_at?: string | null
          state_id?: string | null
          summary?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          article_count?: number
          canonical_article_id?: string | null
          category?: string | null
          created_at?: string
          first_seen_at?: string | null
          id?: string
          image_url?: string | null
          last_seen_at?: string | null
          state_id?: string | null
          summary?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_clusters_canonical_article_id_fkey"
            columns: ["canonical_article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_clusters_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_clusters_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string
          id: string
          state_id: string | null
          tag: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          state_id?: string | null
          tag: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          state_id?: string | null
          tag?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hashtags_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          items_ingested: number
          metadata: Json
          retry_count: number
          source_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_ingested?: number
          metadata?: Json
          retry_count?: number
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_ingested?: number
          metadata?: Json
          retry_count?: number
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lgas: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          state_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          state_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgas_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author: string | null
          category: string | null
          cluster_id: string | null
          content: string | null
          content_hash: string | null
          created_at: string
          external_id: string | null
          id: string
          image_url: string | null
          language: string | null
          published_at: string | null
          source_id: string | null
          state_id: string | null
          summary: string | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          cluster_id?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          image_url?: string | null
          language?: string | null
          published_at?: string | null
          source_id?: string | null
          state_id?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          author?: string | null
          category?: string | null
          cluster_id?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          image_url?: string | null
          language?: string | null
          published_at?: string | null
          source_id?: string | null
          state_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "article_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_articles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_articles_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
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
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_configs: {
        Row: {
          config: Json
          created_at: string
          id: string
          schedule_cron: string | null
          source_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          schedule_cron?: string | null
          source_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          schedule_cron?: string | null
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_configs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string | null
          level: string
          message: string
          metadata: Json
          source_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id?: string | null
          level?: string
          message: string
          metadata?: Json
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          level?: string
          message?: string
          metadata?: Json
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sentiment_results: {
        Row: {
          created_at: string
          id: string
          model: string | null
          negative: number | null
          neutral: number | null
          positive: number | null
          score: number
          sentiment: string
          subject_id: string
          subject_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          negative?: number | null
          neutral?: number | null
          positive?: number | null
          score: number
          sentiment: string
          subject_id: string
          subject_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          negative?: number | null
          neutral?: number | null
          positive?: number | null
          score?: number
          sentiment?: string
          subject_id?: string
          subject_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          base_url: string | null
          created_at: string
          enabled: boolean
          id: string
          key: string
          kind: Database["public"]["Enums"]["provider_kind"]
          last_error: string | null
          last_sync_at: string | null
          name: string
          retry_count: number
          status: Database["public"]["Enums"]["provider_status"]
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          kind: Database["public"]["Enums"]["provider_kind"]
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          retry_count?: number
          status?: Database["public"]["Enums"]["provider_status"]
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["provider_kind"]
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          retry_count?: number
          status?: Database["public"]["Enums"]["provider_status"]
          updated_at?: string
        }
        Relationships: []
      }
      states: {
        Row: {
          capital: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          capital?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          capital?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      topics: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          slug: string
          state_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          state_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          state_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_events: {
        Row: {
          created_at: string
          event_type: string
          hashtag_id: string | null
          id: string
          metadata: Json
          occurred_at: string
          state_id: string | null
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          hashtag_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          state_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          hashtag_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          state_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_events_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_events_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_events_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_scores: {
        Row: {
          confidence: number
          created_at: string
          freshness: number
          growth_velocity: number
          hashtag_id: string | null
          id: string
          mention_volume: number
          news_coverage: number
          score: number
          search_interest: number
          source_diversity: number
          state_id: string | null
          topic_id: string | null
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          freshness?: number
          growth_velocity?: number
          hashtag_id?: string | null
          id?: string
          mention_volume?: number
          news_coverage?: number
          score?: number
          search_interest?: number
          source_diversity?: number
          state_id?: string | null
          topic_id?: string | null
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          confidence?: number
          created_at?: string
          freshness?: number
          growth_velocity?: number
          hashtag_id?: string | null
          id?: string
          mention_volume?: number
          news_coverage?: number
          score?: number
          search_interest?: number
          source_diversity?: number
          state_id?: string | null
          topic_id?: string | null
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_scores_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_scores_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_scores_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "analyst" | "viewer"
      job_status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
      provider_kind:
        | "news"
        | "social"
        | "search_trend"
        | "video"
        | "forum"
        | "other"
      provider_status: "healthy" | "degraded" | "down" | "unknown" | "disabled"
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
      app_role: ["admin", "analyst", "viewer"],
      job_status: ["queued", "running", "succeeded", "failed", "cancelled"],
      provider_kind: [
        "news",
        "social",
        "search_trend",
        "video",
        "forum",
        "other",
      ],
      provider_status: ["healthy", "degraded", "down", "unknown", "disabled"],
    },
  },
} as const
