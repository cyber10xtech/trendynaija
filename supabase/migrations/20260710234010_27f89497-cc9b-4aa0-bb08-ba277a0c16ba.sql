
DO $$
DECLARE
  api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcWFvY3d4dnVpZWRyb2djbmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzU4MjIsImV4cCI6MjA5ODkxMTgyMn0.UJC-jzbv_q4x5fivOUUSDHm0wCOsx1rdjnNas48LKPI';
BEGIN
  PERFORM cron.unschedule('ai-brain-sweep') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='ai-brain-sweep');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ai-brain-sweep',
  '*/30 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--90b567ed-4488-49f3-a77d-637774f21787.lovable.app/api/public/hooks/ai-brain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcWFvY3d4dnVpZWRyb2djbmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzU4MjIsImV4cCI6MjA5ODkxMTgyMn0.UJC-jzbv_q4x5fivOUUSDHm0wCOsx1rdjnNas48LKPI'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
