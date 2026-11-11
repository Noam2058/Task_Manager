import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 20);
  return Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export const nowIso = () => new Date().toISOString();

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function softBg(color: string, pct = 15): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = (...a: Parameters<T>) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

export const isTypingTarget = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  return !!e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || e.isContentEditable);
};
