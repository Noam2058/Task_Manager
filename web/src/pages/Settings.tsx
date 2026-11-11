import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, CalendarPlus, Copy, Download, FileJson, FolderArchive, KeyRound, Layers, LogOut, MapPin, Palette, Plus, RefreshCw, Tag, Trash2, Upload, ListChecks, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAllData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { supabase, SUPABASE_URL } from '@/lib/supabase';
import { deleteRow, insertRow, updateDisplayName, updateRow, updateSettings } from '@/lib/actions';
import { CITIES } from '@/lib/hebcal';
import { PALETTE } from '@/lib/colors';
import { exportJson, exportZip, prepareImport, runImport, type PreparedImport } from '@/lib/transfer';
import { IMPORT_LABELS } from '@/lib/legacyImport';
import { currentSubscription, disablePush, enablePush, pushSupported, sendTestPush } from '@/lib/push';
import { signOut } from '@/lib/session';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/input';
import { Card, LabelChip } from '@/components/ui/misc';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from '@/components/ui/menu';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogModalContent } from '@/components/ui/dialog';
import { confirmDialog } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';

function Section({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-4 border-b border-border py-8 first:pt-2 last:border-0 md:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <div className="flex items-center gap-2 font-semibold [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-muted">{icon}{title}</div>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { profile, labels, workspaces, templates } = useAllData();
  const darkMode = useUI((s) => s.darkMode);
  const setDark = useUI((s) => s.setDark);
  const s = profile?.settings ?? {};

  return (
    <div className="mx-auto max-w-[960px]">
      <PageHeader title="הגדרות" />

      <Section id="appearance" icon={<Palette />} title="מראה ופרופיל">
        <Field label="שם לתצוגה"><Input defaultValue={profile?.display_name} key={profile?.display_name} onBlur={(e) => e.target.value.trim() && e.target.value !== profile?.display_name && updateDisplayName(e.target.value.trim())} className="max-w-xs" /></Field>
        <div className="grid max-w-md grid-cols-3 gap-3">
          {(['light', 'dark', 'system'] as const).map((m) => (
            <button key={m} onClick={() => setDark(m)} className={cn('overflow-hidden rounded border-2 text-start transition-colors', darkMode === m ? 'border-primary' : 'border-border hover:border-border-strong')}>
              <div className={cn('flex h-16 gap-1 p-2', m === 'dark' ? 'dark bg-[#0F1118]' : m === 'light' ? 'light bg-[#F4F5F9]' : 'bg-gradient-to-l from-[#0F1118] to-[#F4F5F9]')}>
                <div className="w-1/3 rounded-sm bg-[var(--surface)]" /><div className="flex flex-1 flex-col gap-1"><div className="h-2 w-2/3 rounded-full bg-[var(--primary)]" /><div className="h-2 rounded-full bg-[var(--surface-3)]" /><div className="h-2 w-1/2 rounded-full bg-[var(--surface-3)]" /></div>
              </div>
              <div className="px-2 py-1.5 text-sm font-medium">{m === 'light' ? 'בהיר' : m === 'dark' ? 'כהה' : 'לפי המערכת'}</div>
            </button>
          ))}
        </div>
      </Section>

      <PushSection />

      <Section id="workspaces" icon={<Layers />} title="מרחבים" description="הפרדה בין עבודה לאישי. כל נושא שייך למרחב אחד.">
        <div className="space-y-2">
          {workspaces.map((w) => (
            <div key={w.id} className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownTrigger asChild><button className="h-6 w-6 shrink-0 rounded-full" style={{ background: w.color }} aria-label="צבע" /></DropdownTrigger>
                <DropdownContent align="start"><div className="grid grid-cols-6 gap-1 p-1">{PALETTE.map((c) => <DropdownItem key={c.value} onSelect={() => updateRow('workspaces', w.id, { color: c.value })} className="h-6 w-6 rounded-full p-0" style={{ background: c.value }}>{' '}</DropdownItem>)}</div></DropdownContent>
              </DropdownMenu>
              <Input defaultValue={w.name} onBlur={(e) => e.target.value.trim() && e.target.value !== w.name && updateRow('workspaces', w.id, { name: e.target.value.trim() })} className="h-8 max-w-xs" />
              {workspaces.length > 1 && <Button size="icon-sm" variant="danger-ghost" aria-label="מחיקה" onClick={async () => {
                if (await confirmDialog({ title: `למחוק את המרחב "${w.name}"?`, description: 'כל הנושאים, המשימות והספרינטים בו יימחקו לצמיתות.', danger: true, confirmLabel: 'מחיקה' })) deleteRow('workspaces', w.id);
              }}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" iconStart={<Plus className="h-4 w-4" />} onClick={() => insertRow('workspaces', { name: 'מרחב חדש', color: PALETTE[workspaces.length % PALETTE.length].value, icon: null, position: workspaces.length + 1 })}>מרחב חדש</Button>
      </Section>

      <SecuritySection />
      <ImportExportSection />

      <Section id="labels" icon={<Tag />} title="תוויות">
        <div className="flex flex-wrap gap-2">
          {labels.map((l) => (
            <DropdownMenu key={l.id}>
              <DropdownTrigger asChild><button><LabelChip name={l.name} color={l.color} className="h-7 cursor-pointer px-2 text-sm" /></button></DropdownTrigger>
              <DropdownContent align="start">
                <div className="grid grid-cols-6 gap-1 p-1">{PALETTE.map((c) => <DropdownItem key={c.value} onSelect={() => updateRow('labels', l.id, { color: c.value })} className="h-6 w-6 rounded-full p-0" style={{ background: c.value }}>{' '}</DropdownItem>)}</div>
                <DropdownItem danger icon={<Trash2 />} onSelect={() => deleteRow('labels', l.id)}>מחיקה</DropdownItem>
              </DropdownContent>
            </DropdownMenu>
          ))}
        </div>
        <form className="flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const n = (new FormData(f).get('n') as string).trim(); if (n) { insertRow('labels', { name: n, color: PALETTE[labels.length % PALETTE.length].value }); f.reset(); } }}>
          <Input name="n" placeholder="תווית חדשה" className="h-8" /><Button size="sm" type="submit" variant="outline">הוספה</Button>
        </form>
      </Section>

      <Section id="templates" icon={<ListChecks />} title="תבניות" description="רשימת תתי-משימות שאפשר להחיל על משימה (מתפריט המשימה או מאוטומציה).">
        {templates.map((t) => (
          <Card key={t.id} className="flex items-start gap-2 p-3">
            <div className="min-w-0 flex-1"><div className="font-medium">{t.name}</div><div className="truncate text-xs text-subtle">{t.items.map((i) => (typeof i === 'string' ? i : i.title)).join(' · ')}</div></div>
            <Button size="icon-sm" variant="danger-ghost" aria-label="מחיקה" onClick={() => deleteRow('templates', t.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
        <TemplateForm />
      </Section>

      <Section id="location" icon={<MapPin />} title="מיקום וזמנים">
        <div className="grid max-w-lg gap-4 sm:grid-cols-2">
          <Field label="עיר (זמני שבת)">
            <Select value={s.shabbat_city ?? 'חיפה'} onChange={(e) => { const c = CITIES.find((x) => x.name === e.target.value)!; updateSettings({ shabbat_city: c.name, shabbat_lat: c.lat, shabbat_lon: c.lon, shabbat_candle_minutes: c.candles }); }}>
              {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="הדלקת נרות (דקות לפני השקיעה)"><Input type="number" min={0} max={60} defaultValue={s.shabbat_candle_minutes ?? 30} key={`c${s.shabbat_candle_minutes}`} onBlur={(e) => updateSettings({ shabbat_candle_minutes: Number(e.target.value) })} /></Field>
          <Field label="יום עבודה (דקות)" hint="לפס העומס ולתכנון היום"><Input type="number" min={60} max={1440} step={30} defaultValue={s.workday_minutes ?? 480} key={`w${s.workday_minutes}`} onBlur={(e) => updateSettings({ workday_minutes: Number(e.target.value) })} /></Field>
          <Field label="שעת סיכום יום"><Input type="number" min={0} max={23} defaultValue={s.daily_summary_hour ?? 18} key={`s${s.daily_summary_hour}`} onBlur={(e) => updateSettings({ daily_summary_hour: Number(e.target.value) })} /></Field>
        </div>
      </Section>

      <IcsSection />
    </div>
  );
}

function TemplateForm() {
  const [name, setName] = useState('');
  const [items, setItems] = useState('');
  return (
    <div className="max-w-md space-y-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם התבנית" className="h-8" />
      <Textarea value={items} onChange={(e) => setItems(e.target.value)} placeholder="תת-משימה בכל שורה" className="min-h-[70px]" />
      <Button size="sm" variant="outline" disabled={!name.trim() || !items.trim()} onClick={() => { insertRow('templates', { name: name.trim(), items: items.split('\n').map((x) => x.trim()).filter(Boolean) }); setName(''); setItems(''); }}>הוספת תבנית</Button>
    </div>
  );
}

function PushSection() {
  const { profile } = useAllData();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { currentSubscription().then((s) => setOn(!!s)).catch(() => {}); }, []);
  const supported = pushSupported();
  const isIOS = /iPhone|iPad/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return (
    <Section id="notifications" icon={<Bell />} title="התראות" description="תזכורות Push מהשרת — מגיעות גם כשהאפליקציה סגורה. כל מכשיר נרשם בנפרד.">
      {!supported ? (
        <p className="text-sm text-muted">{isIOS && !standalone ? 'באייפון: פתח בספארי ← שיתוף ← "הוסף למסך הבית", ואז הפעל התראות מתוך האפליקציה.' : 'הדפדפן לא תומך ב-Push, או שמפתח VAPID לא הוגדר.'}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={on} disabled={busy} onChange={async (v) => {
            setBusy(true);
            try { if (v) await enablePush(); else await disablePush(); setOn(v); toast.success(v ? 'התראות הופעלו במכשיר הזה' : 'התראות כובו'); }
            catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }} />התראות במכשיר הזה</label>
          {on && <Button size="sm" variant="outline" onClick={() => sendTestPush().then(() => toast.success('נשלחה התראת ניסיון')).catch((e) => toast.error(e.message))}>שליחת ניסיון</Button>}
        </div>
      )}
      <Field label="סיכום בוקר (Push) בשעה" hint="משימות להיום ובאיחור. ריק = כבוי">
        <Input type="number" min={0} max={23} className="max-w-[120px]" defaultValue={profile?.settings.morning_push_hour ?? ''} key={`m${profile?.settings.morning_push_hour}`}
          onBlur={(e) => updateSettings({ morning_push_hour: e.target.value === '' ? null : Number(e.target.value) })} />
      </Field>
      <div className="flex items-center gap-2 text-xs text-subtle"><Smartphone className="h-3.5 w-3.5" />להתקנה כאפליקציה: בתפריט הדפדפן ← "התקן אפליקציה" / "הוסף למסך הבית".</div>
    </Section>
  );
}

function SecuritySection() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')); }, []);
  const strong = pw.length >= 10;
  return (
    <Section id="security" icon={<KeyRound />} title="אבטחה" description={email}>
      <div className="grid max-w-md gap-3">
        <Field label="סיסמה חדשה" hint="לפחות 10 תווים" error={pw && !strong ? 'קצרה מדי' : undefined}><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="אימות סיסמה" error={pw2 && pw2 !== pw ? 'לא תואם' : undefined}><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
        <div><Button variant="primary" loading={busy} disabled={!strong || pw !== pw2} onClick={async () => {
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password: pw });
          setBusy(false);
          if (error) toast.error(error.message); else { toast.success('הסיסמה עודכנה'); setPw(''); setPw2(''); }
        }}>החלפת סיסמה</Button></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" iconStart={<LogOut className="h-4 w-4" />} onClick={async () => { if (await confirmDialog({ title: 'להתנתק מכל המכשירים?', confirmLabel: 'התנתקות' })) { await supabase.auth.signOut({ scope: 'global' }); } }}>התנתקות מכל המכשירים</Button>
        <Button variant="ghost" onClick={() => void signOut()}>התנתקות</Button>
      </div>
    </Section>
  );
}

function ImportExportSection() {
  const { workspaces } = useAllData();
  const [busy, setBusy] = useState<string | null>(null);
  const [prep, setPrep] = useState<PreparedImport | null>(null);
  const [ws, setWs] = useState('');
  const [replace, setReplace] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!ws && workspaces[0]) setWs(workspaces[0].id); }, [workspaces, ws]);
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <Section id="backup" icon={<FolderArchive />} title="ייצוא וייבוא" description="הנתונים שמורים ב-Supabase (כולל גיבוי יומי שלהם). כדאי גם לייצא מדי פעם.">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" iconStart={<FileJson className="h-4 w-4" />} loading={busy === 'json'} onClick={() => run('json', exportJson)}>ייצוא JSON</Button>
        <Button variant="outline" iconStart={<Download className="h-4 w-4" />} loading={busy === 'zip'} onClick={() => run('zip', () => exportZip((m) => setBusy(m)))}>ייצוא מלא (ZIP)</Button>
        <Button variant="outline" iconStart={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>ייבוא…</Button>
        <input ref={fileRef} type="file" accept=".json,.zip,application/json,application/zip" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (f) void run('prep', async () => setPrep(await prepareImport(f)));
        }} />
      </div>
      {busy && !['json', 'zip', 'prep'].includes(busy) && <p className="text-sm text-muted">{busy}</p>}
      <p className="text-xs text-subtle">הייבוא תומך גם בקובץ הייצוא (JSON / ZIP) של הגרסה הקודמת של המערכת.</p>

      <Dialog open={!!prep} onOpenChange={(o) => !o && setPrep(null)}>
        <DialogModalContent size="md">
          <DialogHeader title="ייבוא נתונים" icon={<Upload className="h-5 w-5" />} />
          {prep && <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(IMPORT_LABELS).map(([k, l]) => (
                <div key={k} className="rounded bg-surface-2 p-2.5"><div className="text-lg font-bold tabular">{prep.summary.counts[k] ?? 0}</div><div className="text-xs text-muted">{l}</div></div>
              ))}
            </div>
            {prep.summary.warnings.map((w) => <p key={w} className="text-sm text-warning">⚠ {w}</p>)}
            {prep.summary.legacyDocuments.length > 0 && !Object.keys(prep.files).length && <p className="text-sm text-muted">קובץ JSON לא כולל את הקבצים עצמם — רק ZIP מלא משחזר מסמכים.</p>}
            <Field label="לאיזה מרחב לייבא?"><Select value={ws} onChange={(e) => setWs(e.target.value)}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
            <label className="flex items-center gap-2 text-sm"><Switch checked={replace} onChange={setReplace} />למחוק קודם את התוכן הקיים במרחב</label>
          </DialogBody>}
          <DialogFooter>
            <Button variant={replace ? 'danger' : 'primary'} loading={!!busy} onClick={() => run('import', async () => {
              if (replace && !(await confirmDialog({ title: 'למחוק ולהחליף?', description: 'כל הנושאים, המשימות, הספרינטים והמטרות במרחב יימחקו לפני הייבוא.', danger: true, confirmLabel: 'מחיקה וייבוא' }))) return;
              const r = await runImport(prep!, ws, replace, (m) => setBusy(m));
              toast.success(`יובאו ${r.tasks} משימות`);
              setPrep(null);
            })}>ייבוא</Button>
            <Button variant="ghost" onClick={() => setPrep(null)}>ביטול</Button>
          </DialogFooter>
        </DialogModalContent>
      </Dialog>
    </Section>
  );
}

function IcsSection() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { supabase.rpc('ics_token_get').then(({ data }) => setToken((data as string) ?? null)); }, []);
  const url = token ? `${SUPABASE_URL}/functions/v1/ics?token=${token}` : '';
  return (
    <Section id="ics" icon={<CalendarPlus />} title="קישור ליומן חיצוני" description="מנוי ICS ל-Google Calendar / Outlook / יומן אייפון. כל מי שיש לו את הקישור רואה את המשימות — שמור עליו.">
      {token ? (
        <>
          <div className="flex gap-2"><Input value={url} readOnly dir="ltr" className="h-8 text-xs" onFocus={(e) => e.target.select()} /><Button size="sm" variant="outline" iconStart={<Copy className="h-4 w-4" />} onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('הועתק'))}>העתקה</Button></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" iconStart={<RefreshCw className="h-4 w-4" />} onClick={async () => { if (await confirmDialog({ title: 'לחדש את הקישור?', description: 'הקישור הישן יפסיק לעבוד.', confirmLabel: 'חידוש' })) { const { data } = await supabase.rpc('ics_token_rotate'); setToken(data as string); } }}>חידוש</Button>
            <Button size="sm" variant="danger-ghost" onClick={async () => { await supabase.rpc('ics_token_revoke'); setToken(null); }}>ביטול</Button>
          </div>
        </>
      ) : token === null ? (
        <Button variant="outline" onClick={async () => { const { data, error } = await supabase.rpc('ics_token_rotate'); if (error) toast.error(error.message); else setToken(data as string); }}>יצירת קישור</Button>
      ) : null}
    </Section>
  );
}
