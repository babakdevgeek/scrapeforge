import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium transition-[background-color,color,border-color,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 active:translate-y-[0.5px]',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-[color:var(--accent-ink)] hover:brightness-110',
        secondary: 'border border-line bg-raised text-ink hover:border-line-strong hover:bg-sunken',
        ghost: 'text-muted hover:bg-sunken hover:text-ink',
        danger: 'border border-line bg-raised text-danger hover:border-danger hover:bg-[color:var(--danger)]/8',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-7 px-2.5 text-[12.5px]',
        md: 'h-9 px-3.5 text-[13.5px]',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
