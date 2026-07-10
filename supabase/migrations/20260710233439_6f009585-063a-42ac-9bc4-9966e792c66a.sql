
-- Extend topics with lifecycle + velocity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='topics' AND column_name='lifecycle_state') THEN
    ALTER TABLE public.topics
      ADD COLUMN lifecycle_state text NOT NULL DEFAULT 'dormant',
      ADD COLUMN velocity numeric NOT NULL DEFAULT 0,
      ADD COLUMN acceleration numeric NOT NULL DEFAULT 0,
      ADD COLUMN momentum numeric NOT NULL DEFAULT 0,
      ADD COLUMN last_lifecycle_change_at timestamptz;
  END IF;
END $$;

-- Extend ai_summaries with why-trending + emotions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ai_summaries' AND column_name='why_trending') THEN
    ALTER TABLE public.ai_summaries
      ADD COLUMN why_trending text,
      ADD COLUMN why_trending_detailed text,
      ADD COLUMN key_drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN emotions jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN eli15 text,
      ADD COLUMN executive_summary text,
      ADD COLUMN one_sentence text,
      ADD COLUMN three_sentence text;
  END IF;
END $$;

-- Entities
CREATE TABLE IF NOT EXISTS public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  entity_type text NOT NULL,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  mention_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entities_type_idx ON public.entities(entity_type);
CREATE INDEX IF NOT EXISTS entities_last_seen_idx ON public.entities(last_seen_at DESC NULLS LAST);

-- Entity relationships
CREATE TABLE IF NOT EXISTS public.entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  entity_b_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'co_mention',
  strength numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_a_id, entity_b_id, relation_type),
  CHECK (entity_a_id < entity_b_id)
);
CREATE INDEX IF NOT EXISTS entity_relations_a_idx ON public.entity_relations(entity_a_id);
CREATE INDEX IF NOT EXISTS entity_relations_b_idx ON public.entity_relations(entity_b_id);

-- Topic <-> Entity
CREATE TABLE IF NOT EXISTS public.topic_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  mentions integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, entity_id)
);
CREATE INDEX IF NOT EXISTS topic_entities_topic_idx ON public.topic_entities(topic_id);
CREATE INDEX IF NOT EXISTS topic_entities_entity_idx ON public.topic_entities(entity_id);

-- Topic relationships
CREATE TABLE IF NOT EXISTS public.topic_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_a_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  topic_b_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'related',
  strength numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_a_id, topic_b_id, relation_type),
  CHECK (topic_a_id < topic_b_id)
);
CREATE INDEX IF NOT EXISTS topic_relations_a_idx ON public.topic_relations(topic_a_id);
CREATE INDEX IF NOT EXISTS topic_relations_b_idx ON public.topic_relations(topic_b_id);

-- Narratives
CREATE TABLE IF NOT EXISTS public.narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  summary text,
  lifecycle_state text NOT NULL DEFAULT 'emerging',
  confidence numeric NOT NULL DEFAULT 0,
  topic_count integer NOT NULL DEFAULT 0,
  last_evolved_at timestamptz NOT NULL DEFAULT now(),
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS narratives_state_idx ON public.narratives(lifecycle_state);
CREATE INDEX IF NOT EXISTS narratives_last_evolved_idx ON public.narratives(last_evolved_at DESC);

CREATE TABLE IF NOT EXISTS public.narrative_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  narrative_id uuid NOT NULL REFERENCES public.narratives(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  role text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (narrative_id, topic_id)
);
CREATE INDEX IF NOT EXISTS narrative_topics_n_idx ON public.narrative_topics(narrative_id);

-- Alerts
CREATE TABLE IF NOT EXISTS public.trend_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  narrative_id uuid REFERENCES public.narratives(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  fired_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trend_alerts_fired_idx ON public.trend_alerts(fired_at DESC);
CREATE INDEX IF NOT EXISTS trend_alerts_type_idx ON public.trend_alerts(alert_type);
CREATE INDEX IF NOT EXISTS trend_alerts_resolved_idx ON public.trend_alerts(resolved);

-- Predictions
CREATE TABLE IF NOT EXISTS public.trend_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  prediction_type text NOT NULL DEFAULT 'continued_growth',
  probability numeric NOT NULL,
  expected_lifespan_hours integer,
  national_spread_probability numeric,
  confidence_low numeric,
  confidence_high numeric,
  rationale text,
  model text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trend_predictions_topic_idx ON public.trend_predictions(topic_id);
CREATE INDEX IF NOT EXISTS trend_predictions_created_idx ON public.trend_predictions(created_at DESC);

-- Daily briefs
CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date date NOT NULL,
  scope text NOT NULL DEFAULT 'nigeria',
  category text,
  title text NOT NULL,
  summary text NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brief_date, scope, category)
);
CREATE INDEX IF NOT EXISTS daily_briefs_date_idx ON public.daily_briefs(brief_date DESC);
CREATE INDEX IF NOT EXISTS daily_briefs_scope_idx ON public.daily_briefs(scope);

-- AI jobs (observability)
CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'succeeded',
  subject_type text,
  subject_id uuid,
  model text,
  tokens_input integer,
  tokens_output integer,
  duration_ms integer,
  attempts integer NOT NULL DEFAULT 1,
  confidence numeric,
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_jobs_kind_idx ON public.ai_jobs(kind);
CREATE INDEX IF NOT EXISTS ai_jobs_created_idx ON public.ai_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_jobs_status_idx ON public.ai_jobs(status);

-- Grants
GRANT SELECT ON public.entities TO anon, authenticated;
GRANT ALL ON public.entities TO service_role;
GRANT SELECT ON public.entity_relations TO anon, authenticated;
GRANT ALL ON public.entity_relations TO service_role;
GRANT SELECT ON public.topic_entities TO anon, authenticated;
GRANT ALL ON public.topic_entities TO service_role;
GRANT SELECT ON public.topic_relations TO anon, authenticated;
GRANT ALL ON public.topic_relations TO service_role;
GRANT SELECT ON public.narratives TO anon, authenticated;
GRANT ALL ON public.narratives TO service_role;
GRANT SELECT ON public.narrative_topics TO anon, authenticated;
GRANT ALL ON public.narrative_topics TO service_role;
GRANT SELECT ON public.trend_alerts TO anon, authenticated;
GRANT ALL ON public.trend_alerts TO service_role;
GRANT SELECT ON public.trend_predictions TO anon, authenticated;
GRANT ALL ON public.trend_predictions TO service_role;
GRANT SELECT ON public.daily_briefs TO anon, authenticated;
GRANT ALL ON public.daily_briefs TO service_role;
GRANT SELECT ON public.ai_jobs TO authenticated;
GRANT ALL ON public.ai_jobs TO service_role;

-- RLS
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narratives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narrative_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY entities_read ON public.entities FOR SELECT USING (true);
CREATE POLICY entity_relations_read ON public.entity_relations FOR SELECT USING (true);
CREATE POLICY topic_entities_read ON public.topic_entities FOR SELECT USING (true);
CREATE POLICY topic_relations_read ON public.topic_relations FOR SELECT USING (true);
CREATE POLICY narratives_read ON public.narratives FOR SELECT USING (true);
CREATE POLICY narrative_topics_read ON public.narrative_topics FOR SELECT USING (true);
CREATE POLICY trend_alerts_read ON public.trend_alerts FOR SELECT USING (true);
CREATE POLICY trend_predictions_read ON public.trend_predictions FOR SELECT USING (true);
CREATE POLICY daily_briefs_read ON public.daily_briefs FOR SELECT USING (true);
CREATE POLICY ai_jobs_admin_read ON public.ai_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

-- Triggers
CREATE TRIGGER tg_entities_updated BEFORE UPDATE ON public.entities FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_entity_relations_updated BEFORE UPDATE ON public.entity_relations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_topic_relations_updated BEFORE UPDATE ON public.topic_relations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_narratives_updated BEFORE UPDATE ON public.narratives FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_daily_briefs_updated BEFORE UPDATE ON public.daily_briefs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
