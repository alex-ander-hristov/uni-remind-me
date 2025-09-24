-- Simple cron job setup - the extensions are already created from the previous migration
-- Just schedule the cron job to run daily
SELECT cron.schedule(
  'daily-reminder-emails-v2',
  '0 9 * * *', -- Daily at 9:00 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://rswfsvnbiciyqjyyuhjg.supabase.co/functions/v1/send-reminder-emails',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzd2Zzdm5iaWNpeXFqeXl1aGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MTU3OTcsImV4cCI6MjA3NDA5MTc5N30.lYD8tQbqFcJfAm2cZBwID7xcu-D5ixxxG2GIpp7Lmtg"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);