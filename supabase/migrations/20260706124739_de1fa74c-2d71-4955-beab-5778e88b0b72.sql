
-- ============ ROLES & PROFILES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst', 'viewer');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Auto-create profile + viewer role on new user
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ GEOGRAPHY ============
CREATE TABLE public.states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT,
  capital TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.states TO authenticated, anon;
GRANT ALL ON public.states TO service_role;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "States readable by all" ON public.states FOR SELECT USING (true);
CREATE POLICY "Admins manage states" ON public.states FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_states_updated BEFORE UPDATE ON public.states FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.lgas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (state_id, code)
);
CREATE INDEX idx_lgas_state ON public.lgas(state_id);
GRANT SELECT ON public.lgas TO authenticated, anon;
GRANT ALL ON public.lgas TO service_role;
ALTER TABLE public.lgas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LGAs readable by all" ON public.lgas FOR SELECT USING (true);
CREATE POLICY "Admins manage lgas" ON public.lgas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_lgas_updated BEFORE UPDATE ON public.lgas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed Imo State + 27 LGAs
INSERT INTO public.states (code, name, region, capital, is_active) VALUES ('IM', 'Imo', 'South East', 'Owerri', true);
INSERT INTO public.lgas (state_id, code, name)
SELECT s.id, x.code, x.name FROM public.states s, (VALUES
  ('ABO','Aboh Mbaise'),('AHI','Ahiazu Mbaise'),('EHM','Ehime Mbano'),('EZI','Ezinihitte'),
  ('IDE','Ideato North'),('IDS','Ideato South'),('IHI','Ihitte/Uboma'),('IKE','Ikeduru'),
  ('ISI','Isiala Mbano'),('ISU','Isu'),('MBA','Mbaitoli'),('NGO','Ngor Okpala'),
  ('NJA','Njaba'),('NKW','Nkwerre'),('NWA','Nwangele'),('OBO','Obowo'),
  ('OGU','Oguta'),('OHA','Ohaji/Egbema'),('OKI','Okigwe'),('ORLE','Orlu'),
  ('ORS','Orsu'),('ORU','Oru East'),('ORW','Oru West'),('OWE','Owerri Municipal'),
  ('OWN','Owerri North'),('OWS','Owerri West'),('UMU','Unuimo')
) AS x(code,name) WHERE s.code='IM';

-- ============ SOURCES / PROVIDERS ============
CREATE TYPE public.provider_kind AS ENUM ('news','social','search_trend','video','forum','other');
CREATE TYPE public.provider_status AS ENUM ('healthy','degraded','down','unknown','disabled');

CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind public.provider_kind NOT NULL,
  base_url TEXT,
  status public.provider_status NOT NULL DEFAULT 'unknown',
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sources viewable by authenticated" ON public.sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sources" ON public.sources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule_cron TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.provider_configs TO service_role;
GRANT SELECT ON public.provider_configs TO authenticated;
ALTER TABLE public.provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view configs" ON public.provider_configs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage configs" ON public.provider_configs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_provider_configs_updated BEFORE UPDATE ON public.provider_configs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ TOPICS & HASHTAGS ============
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_topics_state ON public.topics(state_id);
GRANT SELECT ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Topics viewable by authenticated" ON public.topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage topics" ON public.topics FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_topics_updated BEFORE UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hashtags_state ON public.hashtags(state_id);
GRANT SELECT ON public.hashtags TO authenticated;
GRANT ALL ON public.hashtags TO service_role;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hashtags viewable by authenticated" ON public.hashtags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage hashtags" ON public.hashtags FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_hashtags_updated BEFORE UPDATE ON public.hashtags FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ ARTICLE CLUSTERS & NEWS ============
CREATE TABLE public.article_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  article_count INT NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clusters_state ON public.article_clusters(state_id);
CREATE INDEX idx_clusters_topic ON public.article_clusters(topic_id);
GRANT SELECT ON public.article_clusters TO authenticated;
GRANT ALL ON public.article_clusters TO service_role;
ALTER TABLE public.article_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clusters viewable by authenticated" ON public.article_clusters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage clusters" ON public.article_clusters FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_clusters_updated BEFORE UPDATE ON public.article_clusters FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  cluster_id UUID REFERENCES public.article_clusters(id) ON DELETE SET NULL,
  external_id TEXT,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  content TEXT,
  image_url TEXT,
  language TEXT DEFAULT 'en',
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  content_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);
CREATE INDEX idx_articles_state ON public.news_articles(state_id);
CREATE INDEX idx_articles_cluster ON public.news_articles(cluster_id);
CREATE INDEX idx_articles_published ON public.news_articles(published_at DESC);
CREATE INDEX idx_articles_hash ON public.news_articles(content_hash);
GRANT SELECT ON public.news_articles TO authenticated;
GRANT ALL ON public.news_articles TO service_role;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles viewable by authenticated" ON public.news_articles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage articles" ON public.news_articles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON public.news_articles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ TREND SCORES & EVENTS ============
CREATE TABLE public.trend_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  hashtag_id UUID REFERENCES public.hashtags(id) ON DELETE CASCADE,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  score NUMERIC(10,4) NOT NULL DEFAULT 0,
  mention_volume INT NOT NULL DEFAULT 0,
  growth_velocity NUMERIC(10,4) NOT NULL DEFAULT 0,
  source_diversity NUMERIC(10,4) NOT NULL DEFAULT 0,
  news_coverage NUMERIC(10,4) NOT NULL DEFAULT 0,
  search_interest NUMERIC(10,4) NOT NULL DEFAULT 0,
  freshness NUMERIC(10,4) NOT NULL DEFAULT 0,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trend_scores_state ON public.trend_scores(state_id);
CREATE INDEX idx_trend_scores_window ON public.trend_scores(window_end DESC);
CREATE INDEX idx_trend_scores_score ON public.trend_scores(score DESC);
GRANT SELECT ON public.trend_scores TO authenticated;
GRANT ALL ON public.trend_scores TO service_role;
ALTER TABLE public.trend_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trend scores viewable by authenticated" ON public.trend_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage trend scores" ON public.trend_scores FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_trend_scores_updated BEFORE UPDATE ON public.trend_scores FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.trend_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  hashtag_id UUID REFERENCES public.hashtags(id) ON DELETE CASCADE,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trend_events_occurred ON public.trend_events(occurred_at DESC);
CREATE INDEX idx_trend_events_state ON public.trend_events(state_id);
GRANT SELECT ON public.trend_events TO authenticated;
GRANT ALL ON public.trend_events TO service_role;
ALTER TABLE public.trend_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trend events viewable by authenticated" ON public.trend_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage trend events" ON public.trend_events FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_trend_events_updated BEFORE UPDATE ON public.trend_events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ AI OUTPUTS ============
CREATE TABLE public.ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  model TEXT,
  summary TEXT NOT NULL,
  bullet_points JSONB,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_summaries_subject ON public.ai_summaries(subject_type, subject_id);
GRANT SELECT ON public.ai_summaries TO authenticated;
GRANT ALL ON public.ai_summaries TO service_role;
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI summaries viewable by authenticated" ON public.ai_summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage AI summaries" ON public.ai_summaries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ai_summaries_updated BEFORE UPDATE ON public.ai_summaries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.sentiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  model TEXT,
  sentiment TEXT NOT NULL,
  score NUMERIC(5,4) NOT NULL,
  positive NUMERIC(5,4),
  neutral NUMERIC(5,4),
  negative NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sentiment_subject ON public.sentiment_results(subject_type, subject_id);
GRANT SELECT ON public.sentiment_results TO authenticated;
GRANT ALL ON public.sentiment_results TO service_role;
ALTER TABLE public.sentiment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sentiment viewable by authenticated" ON public.sentiment_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sentiment" ON public.sentiment_results FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_sentiment_updated BEFORE UPDATE ON public.sentiment_results FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ INGESTION & OPERATIONS ============
CREATE TYPE public.job_status AS ENUM ('queued','running','succeeded','failed','cancelled');

CREATE TABLE public.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE,
  status public.job_status NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  items_ingested INT NOT NULL DEFAULT 0,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_source ON public.ingestion_jobs(source_id);
CREATE INDEX idx_jobs_status ON public.ingestion_jobs(status);
CREATE INDEX idx_jobs_created ON public.ingestion_jobs(created_at DESC);
GRANT ALL ON public.ingestion_jobs TO service_role;
GRANT SELECT ON public.ingestion_jobs TO authenticated;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ingestion jobs" ON public.ingestion_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "Admins manage ingestion jobs" ON public.ingestion_jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.ingestion_jobs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.provider_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.ingestion_jobs(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_source ON public.provider_logs(source_id);
CREATE INDEX idx_logs_created ON public.provider_logs(created_at DESC);
GRANT ALL ON public.provider_logs TO service_role;
GRANT SELECT ON public.provider_logs TO authenticated;
ALTER TABLE public.provider_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view provider logs" ON public.provider_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analyst'));
CREATE POLICY "Admins manage provider logs" ON public.provider_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_logs_updated BEFORE UPDATE ON public.provider_logs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ SYSTEM SETTINGS ============
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings viewable by authenticated" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
