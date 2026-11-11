-- =====================================================================
-- להריץ פעם אחת ב-SQL Editor, אחרי פריסת ה-Edge Functions (ראו README).
-- מפעיל: אוטומציות "תאריך היעד הגיע" כל 10 דקות, ותזכורות Push כל דקה.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) שמירת הכתובת והמפתח ב-Vault (להחליף את הערכים!)
select vault.create_secret('https://<PROJECT-REF>.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET שבחרת>', 'cron_secret');

-- 2) אוטומציות לפי תאריך יעד
select cron.schedule('due-date-automations', '*/10 * * * *',
  $$ select public.run_due_date_automations(); $$);

-- 3) תזכורות Push + סיכום בוקר
select cron.schedule('push-reminders', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);
