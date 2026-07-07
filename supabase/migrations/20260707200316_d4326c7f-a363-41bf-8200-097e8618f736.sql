
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS summary text;

CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON public.news_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_source_id ON public.news_articles (source_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_cluster_id ON public.news_articles (cluster_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON public.news_articles (category);
CREATE INDEX IF NOT EXISTS idx_news_articles_content_hash ON public.news_articles (content_hash);
CREATE INDEX IF NOT EXISTS idx_news_articles_url ON public.news_articles (url);
CREATE INDEX IF NOT EXISTS idx_news_articles_title_trgm ON public.news_articles USING gin (title gin_trgm_ops);

ALTER TABLE public.ai_summaries
  ADD COLUMN IF NOT EXISTS short_summary text,
  ADD COLUMN IF NOT EXISTS detailed_summary text,
  ADD COLUMN IF NOT EXISTS topics jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS entities jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence numeric;

CREATE INDEX IF NOT EXISTS idx_ai_summaries_subject ON public.ai_summaries (subject_type, subject_id);

ALTER TABLE public.article_clusters
  ADD COLUMN IF NOT EXISTS canonical_article_id uuid REFERENCES public.news_articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE INDEX IF NOT EXISTS idx_article_clusters_last_seen ON public.article_clusters (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_clusters_category ON public.article_clusters (category);

CREATE INDEX IF NOT EXISTS idx_provider_logs_source ON public.provider_logs (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source ON public.ingestion_jobs (source_id, created_at DESC);
