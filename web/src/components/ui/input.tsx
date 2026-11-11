import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const base = 'w-full bg-surface border border-border rounded-sm px-3 text-base text-text placeholder:text-subtle transition-colors duration-[120ms] hover:border-border-strong focus:border-primary focus:shadow-focus focus:outline-none aria-[invalid=true]:border-danger disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(base, 'h-9', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(base, 'py-2 min-h-[80px] resize-y', className)} {...p} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(base, 'h-9 appearance-none pe-3 ps-8 bg-no-repeat cursor-pointer', className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238C93A8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'left 10px center' }}
    {...p}>
    {children}
  </select>
));
Select.displayName = 'Select';

export function Field({ label, hint, error, children, className }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {label && <span className="text-sm font-medium text-text">{label}</span>}
      {children}
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-[180ms] disabled:opacity-50', checked ? 'bg-primary' : 'bg-surface-3')}>
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-[180ms]', checked ? '[inset-inline-start:18px]' : '[inset-inline-start:2px]')} />
    </button>
  );
}

export function Checkbox({ checked, onChange, className, label }: { checked: boolean; onChange: (v: boolean) => void; className?: string; label?: string }) {
  return (
    <input type="checkbox" aria-label={label} checked={checked}
      onClick={(e) => e.stopPropagation()} onChange={(e) => onChange(e.target.checked)}
      className={cn('h-4 w-4 shrink-0 appearance-none rounded-[4px] border border-border-strong bg-surface cursor-pointer transition-colors checked:bg-primary checked:border-primary bg-center bg-no-repeat checked:[background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\' fill=\'none\' stroke=\'white\' stroke-width=\'2.5\'%3E%3Cpath d=\'m4 8.5 2.5 2.5L12 5.5\'/%3E%3C/svg%3E")]', className)} />
  );
}
