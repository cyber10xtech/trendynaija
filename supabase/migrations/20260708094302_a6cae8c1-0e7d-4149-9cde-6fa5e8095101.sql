
-- 1. trend_regions
CREATE TABLE public.trend_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_type TEXT NOT NULL CHECK (region_type IN ('nation','state','lga')),
  geo_code TEXT NOT NULL UNIQUE,       -- e.g. 'NG', 'NG-IM'
  name TEXT NOT NULL,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  lga_id UUID REFERENCES public.lgas(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trend_regions_enabled ON public.trend_regions(enabled);
GRANT SELECT ON public.trend_regions TO authenticated;
GRANT ALL ON public.trend_regions TO service_role;
ALTER TABLE public.trend_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regions read" ON public.trend_regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "regions admin write" ON public.trend_regions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_trend_regions_updated BEFORE UPDATE ON public.trend_regions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. google_trends
CREATE TABLE public.google_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES public.trend_regions(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  slug TEXT NOT NULL,
  rank INT,
  traffic TEXT,                        -- Google returns strings like "200K+"
  traffic_value BIGINT,                -- parsed lower-bound numeric
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  articles JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_google_trends_region_time ON public.google_trends(region_id, snapshot_at DESC);
CREATE INDEX idx_google_trends_topic ON public.google_trends(topic_id);
CREATE INDEX idx_google_trends_slug ON public.google_trends(slug);
CREATE INDEX idx_google_trends_snapshot ON public.google_trends(snapshot_at DESC);
GRANT SELECT ON public.google_trends TO authenticated;
GRANT ALL ON public.google_trends TO service_role;
ALTER TABLE public.google_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gt read" ON public.google_trends FOR SELECT TO authenticated USING (true);
CREATE POLICY "gt admin write" ON public.google_trends FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. interest_over_time
CREATE TABLE public.interest_over_time (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  region_id UUID NOT NULL REFERENCES public.trend_regions(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  value NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'google_trends',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (keyword, region_id, ts, source)
);
CREATE INDEX idx_iot_topic_time ON public.interest_over_time(topic_id, ts DESC);
CREATE INDEX idx_iot_region_time ON public.interest_over_time(region_id, ts DESC);
GRANT SELECT ON public.interest_over_time TO authenticated;
GRANT ALL ON public.interest_over_time TO service_role;
ALTER TABLE public.interest_over_time ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iot read" ON public.interest_over_time FOR SELECT TO authenticated USING (true);
CREATE POLICY "iot admin write" ON public.interest_over_time FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. related_queries
CREATE TABLE public.related_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  region_id UUID NOT NULL REFERENCES public.trend_regions(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  query_type TEXT NOT NULL CHECK (query_type IN ('top','rising','breakout')),
  value NUMERIC,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rq_topic ON public.related_queries(topic_id, query_type);
CREATE INDEX idx_rq_keyword_region ON public.related_queries(keyword, region_id, snapshot_at DESC);
GRANT SELECT ON public.related_queries TO authenticated;
GRANT ALL ON public.related_queries TO service_role;
ALTER TABLE public.related_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rq read" ON public.related_queries FOR SELECT TO authenticated USING (true);
CREATE POLICY "rq admin write" ON public.related_queries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. related_topics
CREATE TABLE public.related_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  region_id UUID NOT NULL REFERENCES public.trend_regions(id) ON DELETE CASCADE,
  related_name TEXT NOT NULL,
  related_slug TEXT NOT NULL,
  related_type TEXT,               -- google 'type' e.g. "Topic", "Song"
  relation_kind TEXT NOT NULL CHECK (relation_kind IN ('top','rising','breakout')),
  strength NUMERIC,
  category TEXT,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rt_topic ON public.related_topics(topic_id, relation_kind);
CREATE INDEX idx_rt_keyword_region ON public.related_topics(keyword, region_id, snapshot_at DESC);
GRANT SELECT ON public.related_topics TO authenticated;
GRANT ALL ON public.related_topics TO service_role;
ALTER TABLE public.related_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rt read" ON public.related_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "rt admin write" ON public.related_topics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 6. Seed regions: Nigeria + Imo State
INSERT INTO public.trend_regions (region_type, geo_code, name, state_id, enabled)
VALUES ('nation','NG','Nigeria',NULL,true)
ON CONFLICT (geo_code) DO NOTHING;

INSERT INTO public.trend_regions (region_type, geo_code, name, state_id, enabled)
SELECT 'state','NG-IM','Imo State', s.id, true
FROM public.states s WHERE s.code = 'IM'
ON CONFLICT (geo_code) DO NOTHING;

-- 7. Seed Google Trends provider source
INSERT INTO public.sources (key, name, kind, base_url, enabled, status)
VALUES ('google_trends','Google Trends','search_trend','https://trends.google.com',true,'unknown')
ON CONFLICT (key) DO NOTHING;

-- 8. Extend topics uniqueness for merge/normalization
CREATE UNIQUE INDEX IF NOT EXISTS uq_topics_slug_state ON public.topics(slug, COALESCE(state_id::text,''));
