import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none transition-[background,color,box-shadow,transform] duration-[120ms] active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-xs [background-image:linear-gradient(180deg,rgb(255_255_255/.12),transparent)]',
        secondary: 'bg-surface-2 text-text hover:bg-surface-3',
        ghost: 'text-muted hover:bg-surface-2 hover:text-text',
        outline: 'border border-border bg-surface text-text hover:bg-surface-2 hover:border-border-strong',
        danger: 'bg-danger text-white hover:brightness-110',
        'danger-ghost': 'text-danger hover:bg-danger-soft',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-sm', md: 'h-9 px-3.5 text-base rounded', lg: 'h-11 px-5 text-md rounded',
        icon: 'h-9 w-9 rounded', 'icon-sm': 'h-8 w-8 rounded-sm', 'icon-xs': 'h-6 w-6 rounded-sm',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean; iconStart?: ReactNode; iconEnd?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, iconStart, iconEnd, children, disabled, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : iconStart}
      {children}
      {iconEnd}
    </button>
  ),
);
Button.displayName = 'Button';
