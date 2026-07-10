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
      ai_jobs: {
        Row: {
          attempts: number
          confidence: number | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          kind: string
          model: string | null
          payload: Json
          result: Json
          status: string
          subject_id: string | null
          subject_type: string | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          attempts?: number
          confidence?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          kind: string
          model?: string | null
          payload?: Json
          result?: Json
          status?: string
          subject_id?: string | null
          subject_type?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          attempts?: number
          confidence?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          kind?: string
          model?: string | null
          payload?: Json
          result?: Json
          status?: string
          subject_id?: string | null
          subject_type?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: []
      }
      ai_summaries: {
        Row: {
          bullet_points: Json | null
          categories: Json | null
          confidence: number | null
          created_at: string
          detailed_summary: string | null
          eli15: string | null
          emotions: Json
          entities: Json | null
          executive_summary: string | null
          id: string
          key_drivers: Json
          model: string | null
          one_sentence: string | null
          short_summary: string | null
          state_id: string | null
          subject_id: string
          subject_type: string
          summary: string
          three_sentence: string | null
          topics: Json | null
          updated_at: string
          why_trending: string | null
          why_trending_detailed: string | null
        }
        Insert: {
          bullet_points?: Json | null
          categories?: Json | null
          confidence?: number | null
          created_at?: string
          detailed_summary?: string | null
          eli15?: string | null
          emotions?: Json
          entities?: Json | null
          executive_summary?: string | null
          id?: string
          key_drivers?: Json
          model?: string | null
          one_sentence?: string | null
          short_summary?: string | null
          state_id?: string | null
          subject_id: string
          subject_type: string
          summary: string
          three_sentence?: string | null
          topics?: Json | null
          updated_at?: string
          why_trending?: string | null
          why_trending_detailed?: string | null
        }
        Update: {
          bullet_points?: Json | null
          categories?: Json | null
          confidence?: number | null
          created_at?: string
          detailed_summary?: string | null
          eli15?: string | null
          emotions?: Json
          entities?: Json | null
          executive_summary?: string | null
          id?: string
          key_drivers?: Json
          model?: string | null
          one_sentence?: string | null
          short_summary?: string | null
          state_id?: string | null
          subject_id?: string
          subject_type?: string
          summary?: string
          three_sentence?: string | null
          topics?: Json | null
          updated_at?: string
          why_trending?: string | null
          why_trending_detailed?: string | null
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
      daily_briefs: {
        Row: {
          brief_date: string
          category: string | null
          created_at: string
          id: string
          model: string | null
          scope: string
          sections: Json
          summary: string
          title: string
          top_topics: Json
          updated_at: string
        }
        Insert: {
          brief_date: string
          category?: string | null
          created_at?: string
          id?: string
          model?: string | null
          scope?: string
          sections?: Json
          summary: string
          title: string
          top_topics?: Json
          updated_at?: string
        }
        Update: {
          brief_date?: string
          category?: string | null
          created_at?: string
          id?: string
          model?: string | null
          scope?: string
          sections?: Json
          summary?: string
          title?: string
          top_topics?: Json
          updated_at?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          aliases: Json
          created_at: string
          entity_type: string
          id: string
          last_seen_at: string | null
          mention_count: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          aliases?: Json
          created_at?: string
          entity_type: string
          id?: string
          last_seen_at?: string | null
          mention_count?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          aliases?: Json
          created_at?: string
          entity_type?: string
          id?: string
          last_seen_at?: string | null
          mention_count?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_relations: {
        Row: {
          confidence: number
          created_at: string
          entity_a_id: string
          entity_b_id: string
          evidence_count: number
          id: string
          last_seen_at: string
          relation_type: string
          strength: number
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          entity_a_id: string
          entity_b_id: string
          evidence_count?: number
          id?: string
          last_seen_at?: string
          relation_type?: string
          strength?: number
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          entity_a_id?: string
          entity_b_id?: string
          evidence_count?: number
          id?: string
          last_seen_at?: string
          relation_type?: string
          strength?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_relations_entity_a_id_fkey"
            columns: ["entity_a_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relations_entity_b_id_fkey"
            columns: ["entity_b_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      google_trends: {
        Row: {
          articles: Json
          created_at: string
          id: string
          keyword: string
          rank: number | null
          raw: Json
          region_id: string
          slug: string
          snapshot_at: string
          topic_id: string | null
          traffic: string | null
          traffic_value: number | null
        }
        Insert: {
          articles?: Json
          created_at?: string
          id?: string
          keyword: string
          rank?: number | null
          raw?: Json
          region_id: string
          slug: string
          snapshot_at?: string
          topic_id?: string | null
          traffic?: string | null
          traffic_value?: number | null
        }
        Update: {
          articles?: Json
          created_at?: string
          id?: string
          keyword?: string
          rank?: number | null
          raw?: Json
          region_id?: string
          slug?: string
          snapshot_at?: string
          topic_id?: string | null
          traffic?: string | null
          traffic_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "google_trends_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "trend_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_trends_topic_id_fkey"
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
      interest_over_time: {
        Row: {
          created_at: string
          id: string
          keyword: string
          region_id: string
          source: string
          topic_id: string | null
          ts: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          region_id: string
          source?: string
          topic_id?: string | null
          ts: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          region_id?: string
          source?: string
          topic_id?: string | null
          ts?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "interest_over_time_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "trend_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interest_over_time_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
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
      narrative_topics: {
        Row: {
          added_at: string
          id: string
          narrative_id: string
          position: number
          role: string | null
          topic_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          narrative_id: string
          position?: number
          role?: string | null
          topic_id: string
        }
        Update: {
          added_at?: string
          id?: string
          narrative_id?: string
          position?: number
          role?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_topics_narrative_id_fkey"
            columns: ["narrative_id"]
            isOneToOne: false
            referencedRelation: "narratives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      narratives: {
        Row: {
          confidence: number
          created_at: string
          description: string | null
          id: string
          last_evolved_at: string
          lifecycle_state: string
          model: string | null
          slug: string
          summary: string | null
          title: string
          topic_count: number
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          description?: string | null
          id?: string
          last_evolved_at?: string
          lifecycle_state?: string
          model?: string | null
          slug: string
          summary?: string | null
          title: string
          topic_count?: number
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          description?: string | null
          id?: string
          last_evolved_at?: string
          lifecycle_state?: string
          model?: string | null
          slug?: string
          summary?: string | null
          title?: string
          topic_count?: number
          updated_at?: string
        }
        Relationships: []
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
      related_queries: {
        Row: {
          created_at: string
          id: string
          keyword: string
          query: string
          query_type: string
          region_id: string
          snapshot_at: string
          topic_id: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          query: string
          query_type: string
          region_id: string
          snapshot_at?: string
          topic_id?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          query?: string
          query_type?: string
          region_id?: string
          snapshot_at?: string
          topic_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "related_queries_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "trend_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_queries_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      related_topics: {
        Row: {
          category: string | null
          created_at: string
          id: string
          keyword: string
          region_id: string
          related_name: string
          related_slug: string
          related_type: string | null
          relation_kind: string
          snapshot_at: string
          strength: number | null
          topic_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          keyword: string
          region_id: string
          related_name: string
          related_slug: string
          related_type?: string | null
          relation_kind: string
          snapshot_at?: string
          strength?: number | null
          topic_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          keyword?: string
          region_id?: string
          related_name?: string
          related_slug?: string
          related_type?: string | null
          relation_kind?: string
          snapshot_at?: string
          strength?: number | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "related_topics_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "trend_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
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
      topic_entities: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          last_seen_at: string
          mentions: number
          topic_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          last_seen_at?: string
          mentions?: number
          topic_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          last_seen_at?: string
          mentions?: number
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_entities_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_relations: {
        Row: {
          confidence: number
          created_at: string
          evidence_count: number
          id: string
          last_seen_at: string
          relation_type: string
          strength: number
          topic_a_id: string
          topic_b_id: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence_count?: number
          id?: string
          last_seen_at?: string
          relation_type?: string
          strength?: number
          topic_a_id: string
          topic_b_id: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence_count?: number
          id?: string
          last_seen_at?: string
          relation_type?: string
          strength?: number
          topic_a_id?: string
          topic_b_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_relations_topic_a_id_fkey"
            columns: ["topic_a_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_relations_topic_b_id_fkey"
            columns: ["topic_b_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          acceleration: number
          category: string | null
          created_at: string
          id: string
          last_lifecycle_change_at: string | null
          lifecycle_state: string
          momentum: number
          name: string
          slug: string
          state_id: string | null
          updated_at: string
          velocity: number
        }
        Insert: {
          acceleration?: number
          category?: string | null
          created_at?: string
          id?: string
          last_lifecycle_change_at?: string | null
          lifecycle_state?: string
          momentum?: number
          name: string
          slug: string
          state_id?: string | null
          updated_at?: string
          velocity?: number
        }
        Update: {
          acceleration?: number
          category?: string | null
          created_at?: string
          id?: string
          last_lifecycle_change_at?: string | null
          lifecycle_state?: string
          momentum?: number
          name?: string
          slug?: string
          state_id?: string | null
          updated_at?: string
          velocity?: number
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
      trend_alerts: {
        Row: {
          alert_type: string
          created_at: string
          fired_at: string
          id: string
          message: string | null
          metadata: Json
          narrative_id: string | null
          resolved: boolean
          resolved_at: string | null
          severity: string
          title: string
          topic_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          fired_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          narrative_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title: string
          topic_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          fired_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          narrative_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_alerts_narrative_id_fkey"
            columns: ["narrative_id"]
            isOneToOne: false
            referencedRelation: "narratives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_alerts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
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
      trend_predictions: {
        Row: {
          confidence_high: number | null
          confidence_low: number | null
          created_at: string
          expected_lifespan_hours: number | null
          expires_at: string | null
          id: string
          model: string | null
          national_spread_probability: number | null
          prediction_type: string
          probability: number
          rationale: string | null
          topic_id: string
        }
        Insert: {
          confidence_high?: number | null
          confidence_low?: number | null
          created_at?: string
          expected_lifespan_hours?: number | null
          expires_at?: string | null
          id?: string
          model?: string | null
          national_spread_probability?: number | null
          prediction_type?: string
          probability: number
          rationale?: string | null
          topic_id: string
        }
        Update: {
          confidence_high?: number | null
          confidence_low?: number | null
          created_at?: string
          expected_lifespan_hours?: number | null
          expires_at?: string | null
          id?: string
          model?: string | null
          national_spread_probability?: number | null
          prediction_type?: string
          probability?: number
          rationale?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_predictions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_regions: {
        Row: {
          created_at: string
          enabled: boolean
          geo_code: string
          id: string
          lga_id: string | null
          name: string
          region_type: string
          state_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          geo_code: string
          id?: string
          lga_id?: string | null
          name: string
          region_type: string
          state_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          geo_code?: string
          id?: string
          lga_id?: string | null
          name?: string
          region_type?: string
          state_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_regions_lga_id_fkey"
            columns: ["lga_id"]
            isOneToOne: false
            referencedRelation: "lgas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_regions_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
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
