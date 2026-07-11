
ALTER TABLE public.hashtags
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_rank integer,
  ADD COLUMN IF NOT EXISTS previous_rank integer,
  ADD COLUMN IF NOT EXISTS rank_change integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS velocity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS growth_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS associated_topics uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS associated_entities uuid[] NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS hashtags_tag_state_unique ON public.hashtags (tag, COALESCE(state_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS hashtags_current_rank_idx ON public.hashtags (current_rank NULLS LAST);
CREATE INDEX IF NOT EXISTS hashtags_last_seen_idx ON public.hashtags (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.hashtag_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  usage_count integer NOT NULL DEFAULT 0,
  rank integer,
  growth_rate numeric NOT NULL DEFAULT 0,
  velocity numeric NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS hashtag_snapshots_hashtag_idx ON public.hashtag_snapshots (hashtag_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS hashtag_snapshots_captured_idx ON public.hashtag_snapshots (captured_at DESC);
GRANT SELECT ON public.hashtag_snapshots TO anon, authenticated;
GRANT ALL ON public.hashtag_snapshots TO service_role;
ALTER TABLE public.hashtag_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hashtag_snapshots public read" ON public.hashtag_snapshots;
CREATE POLICY "hashtag_snapshots public read" ON public.hashtag_snapshots FOR SELECT USING (true);
DROP POLICY IF EXISTS "hashtag_snapshots service write" ON public.hashtag_snapshots;
CREATE POLICY "hashtag_snapshots service write" ON public.hashtag_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.social_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  url text,
  author text,
  published_at timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  language text DEFAULT 'en',
  text text NOT NULL,
  hashtags text[] NOT NULL DEFAULT '{}',
  mentions text[] NOT NULL DEFAULT '{}',
  entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  location text,
  state_id uuid REFERENCES public.states(id) ON DELETE SET NULL,
  engagement jsonb NOT NULL DEFAULT '{}'::jsonb,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  category text,
  confidence numeric NOT NULL DEFAULT 0.5,
  content_hash text NOT NULL UNIQUE,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_signals_published_idx ON public.social_signals (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS social_signals_source_idx ON public.social_signals (source_id, published_at DESC);
CREATE INDEX IF NOT EXISTS social_signals_topic_idx ON public.social_signals (topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS social_signals_hashtags_gin ON public.social_signals USING GIN (hashtags);
CREATE INDEX IF NOT EXISTS social_signals_text_trgm ON public.social_signals USING GIN (text gin_trgm_ops);
GRANT SELECT ON public.social_signals TO anon, authenticated;
GRANT ALL ON public.social_signals TO service_role;
ALTER TABLE public.social_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_signals public read" ON public.social_signals;
CREATE POLICY "social_signals public read" ON public.social_signals FOR SELECT USING (true);
DROP POLICY IF EXISTS "social_signals service write" ON public.social_signals;
CREATE POLICY "social_signals service write" ON public.social_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.trend_scores
  ADD COLUMN IF NOT EXISTS social_activity numeric NOT NULL DEFAULT 0;

INSERT INTO public.sources (key, name, kind, base_url, enabled, status) VALUES
  ('reddit-nigeria', 'Reddit r/Nigeria', 'social', 'https://www.reddit.com/r/Nigeria/hot.json?limit=50', true, 'unknown'),
  ('reddit-lagos', 'Reddit r/Lagos', 'social', 'https://www.reddit.com/r/Lagos/hot.json?limit=25', true, 'unknown'),
  ('reddit-naija', 'Reddit r/Naija', 'social', 'https://www.reddit.com/r/Naija/hot.json?limit=25', true, 'unknown')
ON CONFLICT (key) DO NOTHING;
