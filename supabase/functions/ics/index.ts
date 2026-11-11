// פיד ICS ציבורי מוגן בטוקן: /functions/v1/ics?token=...
// לפרוס עם: supabase functions deploy ics --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** קיפול שורות ל-75 בייט (RFC 5545) בלי לשבור תווי UTF-8 */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const compact = (d: string) => d.replace(/-/g, '');
function addMinutes(date: string, time: string, min: number) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + min;
  const days = Math.floor(total / 1440);
  const rest = total % 1440;
  const d = new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  return `${compact(d)}T${String(Math.floor(rest / 60)).padStart(2, '0')}${String(rest % 60).padStart(2, '0')}00`;
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{32,128}$/.test(token)) return new Response('not found', { status: 404 });
  const { data: row } = await admin.from('ics_tokens').select('user_id').eq('token', token).maybeSingle();
  if (!row) return new Response('not found', { status: 404 });

  const { data: tasks } = await admin.from('tasks')
    .select('id,title,description,status,due_date,due_time,estimate_minutes,topic_id,updated_at')
    .eq('user_id', row.user_id).eq('is_archived', false).not('due_date', 'is', null).limit(5000);
  const { data: topics } = await admin.from('topics').select('id,name').eq('user_id', row.user_id);
  const topicName = new Map((topics ?? []).map((t) => [t.id, t.name]));
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//tasks-personal//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:משימות', 'X-WR-TIMEZONE:Asia/Jerusalem'];
  for (const t of tasks ?? []) {
    lines.push('BEGIN:VEVENT', `UID:${t.id}@tasks-personal`, `DTSTAMP:${stamp}`);
    if (t.due_time) {
      lines.push(`DTSTART;TZID=Asia/Jerusalem:${addMinutes(t.due_date, t.due_time, 0)}`);
      lines.push(`DTEND;TZID=Asia/Jerusalem:${addMinutes(t.due_date, t.due_time, t.estimate_minutes || 30)}`);
    } else {
      const next = new Date(Date.parse(t.due_date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
      lines.push(`DTSTART;VALUE=DATE:${compact(t.due_date)}`, `DTEND;VALUE=DATE:${compact(next)}`);
    }
    lines.push(`SUMMARY:${esc((t.status === 'done' ? '✓ ' : '') + t.title)}`);
    const desc = [t.topic_id ? `נושא: ${topicName.get(t.topic_id) ?? ''}` : '', t.description ?? ''].filter(Boolean).join('\n');
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
  });
});
