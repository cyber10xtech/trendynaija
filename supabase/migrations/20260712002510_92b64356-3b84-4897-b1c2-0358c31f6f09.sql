
CREATE TABLE public.topic_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  state_id UUID REFERENCES public.states(id) ON DELETE CASCADE,
  lga_id UUID REFERENCES public.lgas(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'inferred',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  signal_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (state_id IS NOT NULL OR lga_id IS NOT NULL)
);
CREATE UNIQUE INDEX topic_locations_unique ON public.topic_locations(topic_id, COALESCE(state_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(lga_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX topic_locations_state ON public.topic_locations(state_id);
CREATE INDEX topic_locations_lga ON public.topic_locations(lga_id);
CREATE INDEX topic_locations_topic ON public.topic_locations(topic_id);
GRANT SELECT ON public.topic_locations TO authenticated;
GRANT ALL ON public.topic_locations TO service_role;
ALTER TABLE public.topic_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topic_locations_read_auth" ON public.topic_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "topic_locations_service_all" ON public.topic_locations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER topic_locations_updated_at BEFORE UPDATE ON public.topic_locations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.article_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  state_id UUID REFERENCES public.states(id) ON DELETE CASCADE,
  lga_id UUID REFERENCES public.lgas(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'inferred',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (state_id IS NOT NULL OR lga_id IS NOT NULL)
);
CREATE UNIQUE INDEX article_locations_unique ON public.article_locations(article_id, COALESCE(state_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(lga_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX article_locations_state ON public.article_locations(state_id);
CREATE INDEX article_locations_article ON public.article_locations(article_id);
GRANT SELECT ON public.article_locations TO authenticated;
GRANT ALL ON public.article_locations TO service_role;
ALTER TABLE public.article_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "article_locations_read_auth" ON public.article_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "article_locations_service_all" ON public.article_locations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.signal_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.social_signals(id) ON DELETE CASCADE,
  state_id UUID REFERENCES public.states(id) ON DELETE CASCADE,
  lga_id UUID REFERENCES public.lgas(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'inferred',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (state_id IS NOT NULL OR lga_id IS NOT NULL)
);
CREATE UNIQUE INDEX signal_locations_unique ON public.signal_locations(signal_id, COALESCE(state_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(lga_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX signal_locations_state ON public.signal_locations(state_id);
CREATE INDEX signal_locations_signal ON public.signal_locations(signal_id);
GRANT SELECT ON public.signal_locations TO authenticated;
GRANT ALL ON public.signal_locations TO service_role;
ALTER TABLE public.signal_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signal_locations_read_auth" ON public.signal_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "signal_locations_service_all" ON public.signal_locations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.regional_trend_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID REFERENCES public.states(id) ON DELETE CASCADE,
  lga_id UUID REFERENCES public.lgas(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'state',
  time_window TEXT NOT NULL DEFAULT '24h',
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  trend_score REAL NOT NULL DEFAULT 0,
  growth REAL NOT NULL DEFAULT 0,
  sentiment REAL NOT NULL DEFAULT 0,
  signal_count INTEGER NOT NULL DEFAULT 0,
  news_count INTEGER NOT NULL DEFAULT 0,
  social_count INTEGER NOT NULL DEFAULT 0,
  search_interest REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  freshness REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX regional_trend_stats_unique ON public.regional_trend_stats(
  COALESCE(state_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(lga_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(topic_id, '00000000-0000-0000-0000-000000000000'::uuid),
  scope, time_window
);
CREATE INDEX regional_trend_stats_state ON public.regional_trend_stats(state_id, time_window, trend_score DESC);
CREATE INDEX regional_trend_stats_lga ON public.regional_trend_stats(lga_id, time_window, trend_score DESC);
CREATE INDEX regional_trend_stats_scope ON public.regional_trend_stats(scope, time_window, trend_score DESC);
GRANT SELECT ON public.regional_trend_stats TO authenticated;
GRANT ALL ON public.regional_trend_stats TO service_role;
ALTER TABLE public.regional_trend_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regional_trend_stats_read_auth" ON public.regional_trend_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "regional_trend_stats_service_all" ON public.regional_trend_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER regional_trend_stats_updated_at BEFORE UPDATE ON public.regional_trend_stats FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.region_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  lga_id UUID REFERENCES public.lgas(id) ON DELETE SET NULL,
  from_state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX region_alerts_state ON public.region_alerts(state_id, fired_at DESC);
CREATE INDEX region_alerts_topic ON public.region_alerts(topic_id, fired_at DESC);
GRANT SELECT ON public.region_alerts TO authenticated;
GRANT ALL ON public.region_alerts TO service_role;
ALTER TABLE public.region_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "region_alerts_read_auth" ON public.region_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "region_alerts_service_all" ON public.region_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.trend_alerts
  ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lga_id UUID REFERENCES public.lgas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_state_id UUID REFERENCES public.states(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS trend_alerts_state ON public.trend_alerts(state_id, fired_at DESC);
