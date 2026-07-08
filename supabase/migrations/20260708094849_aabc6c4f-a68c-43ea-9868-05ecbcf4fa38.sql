
SELECT cron.unschedule('google-trends-shallow') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-trends-shallow');
SELECT cron.unschedule('google-trends-deep') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-trends-deep');

SELECT cron.schedule(
  'google-trends-shallow', '*/15 * * * *',
  $$ SELECT net.http_post(
    url := 'https://project--90b567ed-4488-49f3-a77d-637774f21787.lovable.app/api/public/hooks/trends-ingest',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcWFvY3d4dnVpZWRyb2djbmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzU4MjIsImV4cCI6MjA5ODkxMTgyMn0.UJC-jzbv_q4x5fivOUUSDHm0wCOsx1rdjnNas48LKPI'),
    body := '{"deep": false}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'google-trends-deep', '0 * * * *',
  $$ SELECT net.http_post(
    url := 'https://project--90b567ed-4488-49f3-a77d-637774f21787.lovable.app/api/public/hooks/trends-ingest',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcWFvY3d4dnVpZWRyb2djbmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzU4MjIsImV4cCI6MjA5ODkxMTgyMn0.UJC-jzbv_q4x5fivOUUSDHm0wCOsx1rdjnNas48LKPI'),
    body := '{"deep": true}'::jsonb
  ); $$
);
