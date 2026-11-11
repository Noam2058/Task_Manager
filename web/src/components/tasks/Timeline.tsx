import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import type { Task } from '@/types';
import { useData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { updateTask } from '@/lib/actions';
import { addDays, diffDays, dow, eachDay, formatDM, MONTH_LONG, parseDate, today } from '@/lib/dates';
import { STATUS_COLOR } from '@/lib/strings';
import { SegmentedControl } from '@/components/ui/segmented';
import { EmptyState } from '@/components/ui/misc';
import { GanttChart } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAME_W = 220;
const ROW_H = 36;

type Drag = { id: string; mode: 'move' | 'start' | 'end'; x0: number; s0: string; e0: string; delta: number };

export function Timeline({ tasks }: { tasks: Task[] }) {
  const { topicById } = useData();
  const openTask = useUI((s) => s.openTask);
  const [zoom, setZoom] = useState<'weeks' | 'months'>('weeks');
  const DW = zoom === 'weeks' ? 36 : 14;
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const rows = useMemo(() => tasks.filter((t) => t.start_date || t.due_date)
    .sort((a, b) => (a.start_date ?? a.due_date!).localeCompare(b.start_date ?? b.due_date!)), [tasks]);
  const t0 = today();
  const [from, to] = useMemo(() => {
    let min = addDays(t0, -7);
    let max = addDays(t0, zoom === 'weeks' ? 35 : 120);
    for (const r of rows) {
      const s = r.start_date ?? r.due_date!;
      const e = r.due_date ?? r.start_date!;
      if (s < min) min = addDays(s, -3);
      if (e > max) max = addDays(e, 7);
    }
    return [min, max];
  }, [rows, t0, zoom]);
  const days = eachDay(from, to);
  const width = days.length * DW;

  const span = (t: Task) => {
    let s = t.start_date ?? t.due_date!;
    let e = t.due_date ?? t.start_date!;
    if (drag?.id === t.id) {
      if (drag.mode !== 'end') s = addDays(drag.s0, drag.delta);
      if (drag.mode !== 'start') e = addDays(drag.e0, drag.delta);
      if (e < s) e = s;
    }
    return { s, e, x: diffDays(s, from) * DW, w: (diffDays(e, s) + 1) * DW };
  };

  const onDown = (e: React.PointerEvent, t: Task, mode: Drag['mode']) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const d = { id: t.id, mode, x0: e.clientX, s0: t.start_date ?? t.due_date!, e0: t.due_date ?? t.start_date!, delta: 0 };
    dragRef.current = d;
    setDrag(d);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    // RTL: תזוזה ימינה = מוקדם יותר
    const delta = -Math.round((e.clientX - d.x0) / DW);
    if (delta !== d.delta) { d.delta = delta; setDrag({ ...d }); }
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (d.delta === 0) { if (d.mode === 'move') openTask(d.id); return; }
    const t = rows.find((r) => r.id === d.id)!;
    let s = d.mode !== 'end' ? addDays(d.s0, d.delta) : d.s0;
    let en = d.mode !== 'start' ? addDays(d.e0, d.delta) : d.e0;
    if (en < s) [s, en] = [en, s];
    const hadRange = !!t.start_date && !!t.due_date;
    if (hadRange || d.mode !== 'move' || t.start_date) updateTask(t.id, { start_date: s === en && !hadRange && d.mode === 'move' ? null : s, due_date: en });
    else updateTask(t.id, { due_date: en });
  };

  if (!rows.length) return <EmptyState icon={<GanttChart />} title="אין משימות עם תאריכים" description="הוסף תאריך התחלה ויעד למשימות כדי לראות אותן על ציר הזמן." />;

  const rowIndex = new Map<string, number>(rows.map((r, i) => [r.id, i] as [string, number]));
  const months: { label: string; x: number; w: number }[] = [];
  days.forEach((d, i) => {
    const m = d.slice(0, 7);
    const last = months[months.length - 1];
    if (!last || last.label !== m) months.push({ label: m, x: i * DW, w: DW });
    else last.w += DW;
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SegmentedControl value={zoom} onChange={setZoom} options={[{ value: 'weeks', label: 'שבועות' }, { value: 'months', label: 'חודשים' }]} />
      </div>
      <div className="card overflow-auto" onPointerMove={onMove} onPointerUp={onUp}>
        <div className="relative" style={{ width: NAME_W + width, minHeight: rows.length * ROW_H + 52 }}>
          {/* כותרות */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-surface" style={{ height: 52 }}>
            <div className="sticky start-0 z-10 shrink-0 border-e border-border bg-surface px-3 py-2 text-xs font-medium text-subtle" style={{ width: NAME_W }}>משימה</div>
            <div className="relative" style={{ width }}>
              {months.map((m) => (
                <div key={m.label} className="absolute top-0 h-6 truncate border-s border-border px-2 text-xs font-semibold leading-6" style={{ insetInlineStart: m.x, width: m.w }}>
                  {MONTH_LONG[parseDate(m.label + '-01').getMonth()]} {m.label.slice(0, 4)}
                </div>
              ))}
              {zoom === 'weeks' && days.map((d, i) => (
                <div key={d} className={cn('absolute top-6 h-6 text-center text-[10px] leading-6 text-subtle tabular', d === t0 && 'font-bold text-danger')} style={{ insetInlineStart: i * DW, width: DW }}>{parseDate(d).getDate()}</div>
              ))}
            </div>
          </div>
          {/* רקע: סופ"ש + היום */}
          <div className="pointer-events-none absolute bottom-0 top-[52px]" style={{ insetInlineStart: NAME_W, width }}>
            {days.map((d, i) => (dow(d) === 5 || dow(d) === 6) && <div key={d} className="absolute inset-y-0 bg-surface-2/70" style={{ insetInlineStart: i * DW, width: DW }} />)}
            <div className="absolute inset-y-0 w-0.5 bg-danger" style={{ insetInlineStart: diffDays(t0, from) * DW + DW / 2 }} />
          </div>
          {/* חיצי תלויות */}
          <svg className="pointer-events-none absolute top-[52px] z-[5]" style={{ insetInlineStart: NAME_W, width, height: rows.length * ROW_H, direction: 'ltr' }}>
            <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--text-subtle)" /></marker></defs>
            {rows.flatMap((t) => t.depends_on.filter((d) => rowIndex.has(d)).map((depId) => {
              const dep = rows[rowIndex.get(depId)!];
              const a = span(dep); const b = span(t);
              // ב-RTL: סוף התלות = הקצה השמאלי שלה
              const x1 = width - (a.x + a.w); const y1 = rowIndex.get(depId)! * ROW_H + ROW_H / 2;
              const x2 = width - b.x; const y2 = rowIndex.get(t.id)! * ROW_H + ROW_H / 2;
              return <path key={`${t.id}-${depId}`} d={`M${x1},${y1} H${x1 - 8} V${y2} H${x2 + 2}`} fill="none" stroke="var(--text-subtle)" strokeWidth="1.5" markerEnd="url(#arr)" />;
            }))}
          </svg>
          {/* שורות */}
          {rows.map((t, i) => {
            const sp = span(t);
            const color = STATUS_COLOR[t.status];
            const topic = t.topic_id ? topicById.get(t.topic_id) : undefined;
            return (
              <div key={t.id} className="absolute flex w-full border-b border-border/60" style={{ top: 52 + i * ROW_H, height: ROW_H }}>
                <button onClick={() => openTask(t.id)} className="sticky start-0 z-10 flex shrink-0 items-center gap-2 truncate border-e border-border bg-surface px-3 text-start text-sm hover:text-primary" style={{ width: NAME_W }}>
                  {topic && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: topic.color }} />}
                  <span className={cn('truncate', t.status === 'done' && 'text-subtle line-through')}>{t.title}</span>
                </button>
                <div className="relative" style={{ width }}>
                  <div onPointerDown={(e) => onDown(e, t, 'move')}
                    className={cn('group absolute top-1.5 flex h-6 cursor-grab touch-none items-center rounded-full px-2 text-[11px] font-medium text-white shadow-xs active:cursor-grabbing', drag?.id === t.id && 'ring-2 ring-primary')}
                    style={{ insetInlineStart: sp.x, width: Math.max(sp.w, DW), background: color }}
                    title={`${formatDM(sp.s)} – ${formatDM(sp.e)}`}>
                    <span onPointerDown={(e) => onDown(e, t, 'start')} className="absolute inset-y-0 start-0 w-2 cursor-ew-resize rounded-s-full group-hover:bg-black/15" />
                    <span className="truncate">{sp.w > 70 ? t.title : ''}</span>
                    <span onPointerDown={(e) => onDown(e, t, 'end')} className="absolute inset-y-0 end-0 w-2 cursor-ew-resize rounded-e-full group-hover:bg-black/15" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
