// תזכורות Push — נקרא מ-pg_cron כל דקה (ראו supabase/cron.sql), או מהאפליקציה לבדיקה ({test:true}).
// משתני סביבה (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

function israelNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  const hour = Number(g('hour')) % 24;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour, minutes: hour * 60 + Number(g('minute')) };
}

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

async function sendTo(subs: Sub[], payload: Record<string, unknown>) {
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id); // מנוי שפג
      else console.error('push failed', code, (e as Error).message);
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const body = await req.json().catch(() => ({}));

  // בדיקה מהאפליקציה — מאומת לפי JWT של המשתמש
  if (body.test) {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return new Response('unauthorized', { status: 401, headers: cors });
    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', user.id);
    const n = await sendTo((subs ?? []) as Sub[], { title: 'התראת ניסיון ✓', body: 'ההתראות עובדות במכשיר הזה', url: '/today', tag: 'test' });
    return Response.json({ sent: n }, { headers: cors });
  }

  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('forbidden', { status: 403 });

  const now = israelNow();
  const { data: subsAll } = await admin.from('push_subscriptions').select('*');
  const byUser = new Map<string, Sub[]>();
  for (const s of (subsAll ?? []) as Sub[]) (byUser.get(s.user_id) ?? byUser.set(s.user_id, []).get(s.user_id)!).push(s);
  if (!byUser.size) return Response.json({ ok: true, users: 0 });

  // 1) תזכורות לפי שעת יעד (היום ומחר — בשביל "יום לפני")
  const tomorrow = new Date(Date.parse(now.date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const { data: tasks } = await admin.from('tasks')
    .select('id,user_id,title,due_date,due_time,remind_before_min,reminded_key,topic_id')
    .in('user_id', [...byUser.keys()]).in('due_date', [now.date, tomorrow])
    .not('due_time', 'is', null).neq('status', 'done').eq('is_archived', false);
  let reminders = 0;
  for (const t of tasks ?? []) {
    const [h, m] = (t.due_time as string).split(':').map(Number);
    const dueMin = h * 60 + m + (t.due_date === tomorrow ? 1440 : 0);
    const at = dueMin - (t.remind_before_min ?? 0);
    const key = `${t.due_date} ${t.due_time}`;
    // חלון של 30 דק' — כדי לא לפספס אם ה-cron איחר, ולא לשלוח תזכורות ישנות
    if (now.minutes >= at && now.minutes - at < 30 && t.reminded_key !== key) {
      const { data: claimed } = await admin.from('tasks').update({ reminded_key: key }).eq('id', t.id).or(`reminded_key.is.null,reminded_key.neq."${key}"`).select('id');
      if (!claimed?.length) continue; // מישהו אחר כבר שלח
      const when = t.remind_before_min ? `בעוד ${t.remind_before_min >= 60 ? `${Math.round(t.remind_before_min / 60)} שע׳` : `${t.remind_before_min} דק׳`} · ${t.due_time}` : `עכשיו · ${t.due_time}`;
      reminders += await sendTo(byUser.get(t.user_id) ?? [], { title: t.title, body: `⏰ ${when}`, url: `/today?task=${t.id}`, tag: `task-${t.id}` });
    }
  }

  // 2) סיכום בוקר
  const { data: profiles } = await admin.from('profiles').select('user_id,settings,last_morning_push').in('user_id', [...byUser.keys()]);
  let summaries = 0;
  for (const p of profiles ?? []) {
    const hour = p.settings?.morning_push_hour;
    if (hour === null || hour === undefined || hour === '' || now.hour < Number(hour) || p.last_morning_push === now.date) continue;
    await admin.from('profiles').update({ last_morning_push: now.date }).eq('user_id', p.user_id);
    const { data: open } = await admin.from('tasks').select('id,title,due_date').eq('user_id', p.user_id).neq('status', 'done').eq('is_archived', false).lte('due_date', now.date);
    const todayList = (open ?? []).filter((x) => x.due_date === now.date);
    const overdue = (open ?? []).filter((x) => x.due_date < now.date);
    if (!todayList.length && !overdue.length) continue;
    const bodyText = [todayList.length ? `${todayList.length} להיום` : '', overdue.length ? `${overdue.length} באיחור` : ''].filter(Boolean).join(' · ')
      + (todayList.length ? `\n${todayList.slice(0, 4).map((x) => `• ${x.title}`).join('\n')}` : '');
    summaries += await sendTo(byUser.get(p.user_id) ?? [], { title: 'בוקר טוב ☀️', body: bodyText, url: '/today', tag: `morning-${now.date}` });
  }

  return Response.json({ ok: true, reminders, summaries });
});
