import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import heLocale from '@fullcalendar/core/locales/he';
import type { EventDropArg, EventInput } from '@fullcalendar/core';
import type { Task } from '@/types';
import { useData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { updateTask } from '@/lib/actions';
import { addDays, diffDays, hebrewDay, isoDate, startOfMonth, endOfMonth } from '@/lib/dates';
import { getDayInfos, isShabbat } from '@/lib/hebcal';
import { STATUS_COLOR } from '@/lib/strings';
import { confirmDialog } from '@/components/ui/confirm';
import type { QuickAddDefaults } from './QuickAdd';

export function TaskCalendar({ tasks, colorBy = 'topic', defaults = {} }: { tasks: Task[]; colorBy?: 'topic' | 'status'; defaults?: QuickAddDefaults }) {
  const { topicById, sprints, profile } = useData();
  const openTask = useUI((s) => s.openTask);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const [range, setRange] = useState<[string, string]>(() => {
    const t = isoDate();
    return [addDays(startOfMonth(t), -7), addDays(endOfMonth(t), 7)];
  });
  const infos = useMemo(() => getDayInfos(range[0], range[1], profile?.settings), [range, profile?.settings]);

  const events: EventInput[] = useMemo(() => {
    const evs: EventInput[] = [];
    for (const t of tasks) {
      const start = t.start_date ?? t.due_date;
      const end = t.due_date ?? t.start_date;
      if (!start || !end) continue;
      const color = colorBy === 'status' ? STATUS_COLOR[t.status] : (t.topic_id && topicById.get(t.topic_id)?.color) || 'var(--primary)';
      const multi = start < end;
      evs.push({
        id: t.id, title: (t.status === 'done' ? '✓ ' : '') + t.title, start: multi ? start : end,
        end: multi ? addDays(end, 1) : undefined, allDay: true,
        backgroundColor: multi ? `color-mix(in srgb, ${color} 22%, var(--surface))` : color,
        textColor: multi ? 'var(--text)' : '#fff', borderColor: color,
        classNames: [t.status === 'done' ? 'opacity-60' : '', multi ? 'border-s-[3px]' : ''],
        extendedProps: { multi },
      });
    }
    for (const s of sprints) {
      if (!s.start_date || !s.end_date) continue;
      evs.push({ start: s.start_date, end: addDays(s.end_date, 1), display: 'background', backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)` });
    }
    for (const [d, info] of infos) {
      for (const h of info.holidays) evs.push({ start: d, allDay: true, title: h, display: 'list-item', textColor: 'var(--text-muted)', backgroundColor: 'transparent', editable: false, classNames: ['!text-[11px]'] });
    }
    return evs;
  }, [tasks, colorBy, topicById, sprints, infos]);

  const onDrop = async (arg: EventDropArg) => {
    const t = tasks.find((x) => x.id === arg.event.id);
    if (!t || !arg.event.start) return arg.revert();
    const newStart = isoDate(arg.event.start);
    const oldStart = (t.start_date && t.due_date && t.start_date < t.due_date) ? t.start_date : t.due_date!;
    const delta = diffDays(newStart, oldStart);
    const newDue = t.due_date ? addDays(t.due_date, delta) : null;
    const info = newDue ? infos.get(newDue) : undefined;
    if (newDue && (isShabbat(newDue) || info?.isYomTov)) {
      const ok = await confirmDialog({ title: 'להעביר לשבת/חג?', description: 'תאריך היעד החדש נופל בשבת או בחג.', confirmLabel: 'להעביר' });
      if (!ok) return arg.revert();
    }
    updateTask(t.id, { due_date: newDue, start_date: t.start_date ? addDays(t.start_date, delta) : null });
  };

  return (
    <div className="card overflow-hidden p-2 sm:p-4">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={heLocale}
        direction="rtl"
        firstDay={0}
        height="auto"
        dayMaxEvents={3}
        editable
        eventStartEditable
        eventDurationEditable={false}
        headerToolbar={{ start: 'title', center: '', end: 'prev,today,next' }}
        buttonText={{ today: 'היום' }}
        events={events}
        datesSet={(a) => setRange([isoDate(a.start), isoDate(a.end)])}
        eventClick={(a) => { if (a.event.id) openTask(a.event.id); }}
        eventDrop={onDrop}
        dateClick={(a) => openQuickAdd({ ...defaults, due_date: a.dateStr })}
        dayCellContent={(a) => {
          const d = isoDate(a.date);
          const info = infos.get(d);
          return (
            <div className="flex w-full items-center justify-between gap-1">
              <span className="text-[10px] text-subtle">{hebrewDay(d)}</span>
              <span>{a.dayNumberText.replace('יום ', '')}</span>
              {(info?.candles || info?.havdalah) && <span className="hidden text-[10px] text-subtle sm:inline">{info.candles ? `🕯${info.candles}` : `✨${info.havdalah}`}</span>}
            </div>
          );
        }}
      />
    </div>
  );
}
