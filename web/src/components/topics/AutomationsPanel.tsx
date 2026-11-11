import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Trash2 } from 'lucide-react';
import type { Automation, Priority, Status } from '@/types';
import { supabase } from '@/lib/supabase';
import { exec } from '@/lib/db';
import { newId, nowIso } from '@/lib/utils';
import { useData } from '@/lib/state';
import { STATUS_LABEL, PRIORITY_LABEL } from '@/lib/strings';
import { STATUS_ORDER, PRIORITY_ORDER } from '@/lib/filters';
import { Button } from '@/components/ui/button';
import { Input, Select, Switch } from '@/components/ui/input';
import { Card, EmptyState } from '@/components/ui/misc';

type Trig = Automation['trigger'];
type Act = Automation['action'];

export function AutomationsPanel({ topicId }: { topicId: string }) {
  const qc = useQueryClient();
  const key = ['automations', topicId];
  const { groups, labels, sprints, templates } = useData();
  const topicGroups = groups.filter((g) => g.topic_id === topicId);
  const { data: list = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('automations').select('*').eq('topic_id', topicId).order('created_at');
      if (error) throw error;
      return data as Automation[];
    },
  });
  const [trigger, setTrigger] = useState<Trig>({ type: 'status_changed', to: 'done' });
  const [action, setAction] = useState<Act>({ type: 'move_group', group_id: topicGroups[0]?.id });
  const [name, setName] = useState('');

  const describe = (t: Trig, a: Act) => {
    const tt = t.type === 'status_changed' ? `הסטטוס משתנה ל"${STATUS_LABEL[t.to ?? 'done']}"`
      : t.type === 'task_created' ? `משימה נוצרת${t.group_id ? ` ב"${groups.find((g) => g.id === t.group_id)?.name ?? ''}"` : ''}`
        : t.type === 'due_date' ? 'תאריך היעד מגיע' : 'כל הצ׳קליסט הושלם';
    const at = a.type === 'move_group' ? `העבר ל"${groups.find((g) => g.id === a.group_id)?.name ?? ''}"`
      : a.type === 'set_status' ? `שנה סטטוס ל"${STATUS_LABEL[a.status ?? 'done']}"`
        : a.type === 'set_priority' ? `שנה עדיפות ל"${PRIORITY_LABEL[a.priority ?? 'high']}"`
          : a.type === 'add_label' ? `הוסף תווית "${labels.find((l) => l.id === a.label_id)?.name ?? ''}"`
            : a.type === 'set_sprint' ? `שייך לספרינט "${sprints.find((s) => s.id === a.sprint_id)?.name ?? ''}"`
              : `צור משימות מתבנית "${templates.find((x) => x.id === a.template_id)?.name ?? ''}"`;
    return `כאשר ${tt} ← ${at}`;
  };
  const valid = (a: Act) => (a.type === 'move_group' ? !!a.group_id : a.type === 'add_label' ? !!a.label_id : a.type === 'set_sprint' ? !!a.sprint_id : a.type === 'apply_template' ? !!a.template_id : true);

  const add = () => {
    if (!valid(action)) return;
    const row: Automation = { id: newId(), topic_id: topicId, name: name.trim() || describe(trigger, action), trigger, action, is_enabled: true, created_at: nowIso() };
    qc.setQueryData<Automation[]>(key, (o) => [...(o ?? []), row]);
    void exec({ t: 'insert', table: 'automations', rows: [{ id: row.id, topic_id: topicId, name: row.name, trigger, action, is_enabled: true }] });
    setName('');
  };
  const patch = (id: string, p: Partial<Automation>) => {
    qc.setQueryData<Automation[]>(key, (o) => (o ?? []).map((x) => (x.id === id ? { ...x, ...p } : x)));
    void exec({ t: 'update', table: 'automations', match: { id }, patch: p });
  };
  const remove = (id: string) => {
    qc.setQueryData<Automation[]>(key, (o) => (o ?? []).filter((x) => x.id !== id));
    void exec({ t: 'delete', table: 'automations', match: { id } });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 text-md font-semibold">אוטומציה חדשה</div>
        <div className="grid gap-3 md:grid-cols-[auto_1fr_auto_1fr] md:items-center">
          <span className="font-semibold text-primary">כאשר</span>
          <div className="flex gap-2">
            <Select value={trigger.type} onChange={(e) => setTrigger({ type: e.target.value as Trig['type'], to: 'done' })}>
              <option value="status_changed">הסטטוס משתנה ל…</option>
              <option value="task_created">משימה נוצרת</option>
              <option value="due_date">תאריך היעד מגיע</option>
              <option value="checklist_done">כל הצ׳קליסט הושלם</option>
            </Select>
            {trigger.type === 'status_changed' && <Select value={trigger.to} onChange={(e) => setTrigger({ ...trigger, to: e.target.value as Status })}>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select>}
            {trigger.type === 'task_created' && <Select value={trigger.group_id ?? ''} onChange={(e) => setTrigger({ ...trigger, group_id: e.target.value || null })}><option value="">בכל קבוצה</option>{topicGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}
          </div>
          <span className="font-semibold text-primary">אז</span>
          <div className="flex gap-2">
            <Select value={action.type} onChange={(e) => setAction({ type: e.target.value as Act['type'] })}>
              <option value="move_group">העבר לקבוצה</option>
              <option value="set_status">שנה סטטוס</option>
              <option value="set_priority">שנה עדיפות</option>
              <option value="add_label">הוסף תווית</option>
              <option value="set_sprint">שייך לספרינט</option>
              <option value="apply_template">צור משימות מתבנית</option>
            </Select>
            {action.type === 'move_group' && <Select value={action.group_id ?? ''} onChange={(e) => setAction({ ...action, group_id: e.target.value })}><option value="">בחר…</option>{topicGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}
            {action.type === 'set_status' && <Select value={action.status ?? ''} onChange={(e) => setAction({ ...action, status: e.target.value as Status })}><option value="">בחר…</option>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select>}
            {action.type === 'set_priority' && <Select value={action.priority ?? ''} onChange={(e) => setAction({ ...action, priority: e.target.value as Priority })}><option value="">בחר…</option>{PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</Select>}
            {action.type === 'add_label' && <Select value={action.label_id ?? ''} onChange={(e) => setAction({ ...action, label_id: e.target.value })}><option value="">בחר…</option>{labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>}
            {action.type === 'set_sprint' && <Select value={action.sprint_id ?? ''} onChange={(e) => setAction({ ...action, sprint_id: e.target.value })}><option value="">בחר…</option>{sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
            {action.type === 'apply_template' && <Select value={action.template_id ?? ''} onChange={(e) => setAction({ ...action, template_id: e.target.value })}><option value="">בחר…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`שם (אופציונלי) — ${describe(trigger, action)}`} />
          <Button variant="primary" onClick={add} disabled={!valid(action)} iconStart={<Plus className="h-4 w-4" />}>הוספה</Button>
        </div>
      </Card>
      {!list.length ? <EmptyState compact icon={<Bot />} title="אין אוטומציות" description="אוטומציות רצות בשרת — גם כשהאפליקציה סגורה." /> : (
        <div className="space-y-2">
          {list.map((a) => (
            <Card key={a.id} className="flex items-center gap-3 p-3">
              <Bot className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                <div className="truncate text-xs text-subtle">{describe(a.trigger, a.action)}</div>
              </div>
              <Switch checked={a.is_enabled} onChange={(v) => patch(a.id, { is_enabled: v })} label="הפעלה" />
              <Button variant="danger-ghost" size="icon-sm" aria-label="מחיקה" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
