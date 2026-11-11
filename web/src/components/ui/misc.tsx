import type * as React from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle, BookOpen, Briefcase, Camera, ChevronDown, ChevronUp, ChevronsUp, Code, Coffee, Dumbbell, Flame,
  Folder, GraduationCap, Heart, Home, Lightbulb, Leaf, Music, Plane, Rocket, ShoppingCart, Star, Target, Users, Wrench,
} from 'lucide-react';
import type { Priority, Status, Task } from '@/types';
import { cn, softBg } from '@/lib/utils';
import { PRIORITY_COLOR, PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL } from '@/lib/strings';
import { formatRelative, today } from '@/lib/dates';
import { STATUS_ORDER } from '@/lib/filters';

export function StatusPill({ status, variant = 'soft', className }: { status: Status; variant?: 'solid' | 'soft'; className?: string }) {
  const c = STATUS_COLOR[status];
  if (variant === 'solid')
    return (
      <span className={cn('inline-flex h-8 w-full items-center justify-center rounded-sm px-2 text-sm font-medium text-white transition-[filter] hover:brightness-105', className)} style={{ background: c }}>
        {STATUS_LABEL[status]}
      </span>
    );
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium', className)} style={{ background: softBg(c), color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIO_ICON: Record<Priority, typeof Flame> = { critical: Flame, high: ChevronsUp, medium: ChevronUp, low: ChevronDown };
export function PriorityBadge({ priority, showLabel = true, className }: { priority: Priority; showLabel?: boolean; className?: string }) {
  const Icon = PRIO_ICON[priority];
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', className)} style={{ color: PRIORITY_COLOR[priority] }}>
      <Icon className="h-4 w-4" strokeWidth={2.4} />
      {showLabel && PRIORITY_LABEL[priority]}
    </span>
  );
}

export function DatePill({ date, time, done, className }: { date: string | null; time?: string | null; done?: boolean; className?: string }) {
  if (!date) return <span className={cn('text-sm text-subtle', className)}>—</span>;
  const t = today();
  const overdue = !done && date < t;
  const isToday = date === t;
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm tabular whitespace-nowrap', overdue ? 'text-danger font-medium' : isToday ? 'text-warning font-medium' : 'text-muted', done && 'line-through opacity-60', className)}>
      {overdue && <AlertCircle className="h-3.5 w-3.5" />}
      {formatRelative(date, t)}
      {time && <span className="text-subtle">· {time}</span>}
    </span>
  );
}

export function LabelChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded-[4px] border-s-[3px] px-1.5 text-xs font-medium whitespace-nowrap', className)}
      style={{ background: softBg(color, 18), borderColor: color, color: 'var(--text)' }}>
      {name}
    </span>
  );
}

export const ICONS: Record<string, typeof Folder> = {
  folder: Folder, briefcase: Briefcase, home: Home, heart: Heart, star: Star, book: BookOpen, code: Code,
  cart: ShoppingCart, plane: Plane, users: Users, idea: Lightbulb, target: Target, music: Music, camera: Camera,
  fitness: Dumbbell, study: GraduationCap, tools: Wrench, rocket: Rocket, leaf: Leaf, coffee: Coffee,
};
const TILE: Record<string, string> = { xs: 'h-5 w-5 rounded-[5px] text-[10px] [&>svg]:h-3 [&>svg]:w-3', sm: 'h-6 w-6 rounded-[6px] text-xs [&>svg]:h-3.5 [&>svg]:w-3.5', md: 'h-8 w-8 rounded-sm text-sm [&>svg]:h-4 [&>svg]:w-4', lg: 'h-12 w-12 rounded text-lg [&>svg]:h-6 [&>svg]:w-6' };
export function IconTile({ icon, name, color, size = 'sm', className }: { icon?: string | null; name: string; color: string; size?: keyof typeof TILE; className?: string }) {
  const Icon = icon ? ICONS[icon] : undefined;
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center font-bold text-white shadow-xs', TILE[size], className)}
      style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${color} 85%, white), ${color})` }}>
      {Icon ? <Icon strokeWidth={2.2} /> : name.trim().charAt(0)}
    </span>
  );
}

export function ProgressBar({ value, color = 'var(--primary)', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function BatteryBar({ tasks, className }: { tasks: Pick<Task, 'status'>[]; className?: string }) {
  if (!tasks.length) return null;
  return (
    <div className={cn('flex h-2 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      {STATUS_ORDER.map((s) => {
        const n = tasks.filter((t) => t.status === s).length;
        return n ? <div key={s} title={`${STATUS_LABEL[s]}: ${n}`} style={{ width: `${(n / tasks.length) * 100}%`, background: STATUS_COLOR[s] }} /> : null;
      })}
    </div>
  );
}

export function ProgressRing({ value, size = 64, stroke = 6, color = 'var(--primary)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value / 100)))} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action, compact }: { icon: ReactNode; title: string; description?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center animate-rise', compact ? 'gap-2 py-8' : 'gap-3 py-16')}>
      <div className={cn('flex items-center justify-center rounded-full bg-primary-soft text-primary', compact ? 'h-10 w-10 [&>svg]:h-5 [&>svg]:w-5' : 'h-14 w-14 [&>svg]:h-7 [&>svg]:w-7')}>{icon}</div>
      <div>
        <div className={cn('font-semibold', compact ? 'text-base' : 'text-md')}>{title}</div>
        {description && <div className="mt-1 max-w-sm text-sm text-muted">{description}</div>}
      </div>
      {action}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-sm bg-surface-3 [animation-duration:1.6s]', className)} />;
export function SkeletonRows({ n = 6 }: { n?: number }) {
  return <div className="space-y-2 p-4">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-border border-b-2 bg-surface-2 px-1 font-sans text-[11px] text-muted">{children}</kbd>
);

export function Card({ children, className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...p}>{children}</div>;
}
export function CardHeader({ title, action, icon }: { title: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      {icon && <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <h3 className="flex-1 text-md font-semibold">{title}</h3>
      {action}
    </div>
  );
}
export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'danger' | 'primary' | 'warning'; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular',
      tone === 'neutral' && 'bg-surface-3 text-muted', tone === 'danger' && 'bg-danger text-white', tone === 'primary' && 'bg-primary text-white', tone === 'warning' && 'bg-warning text-white', className)}>
      {children}
    </span>
  );
}
