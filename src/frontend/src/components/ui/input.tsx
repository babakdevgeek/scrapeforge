import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full rounded border border-line bg-raised px-3 text-[13.5px] text-ink placeholder:text-faint transition-colors duration-150 ease-out hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/18';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, 'h-9', className)} {...props} />,
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, 'min-h-[80px] py-2 font-mono text-[12.5px] leading-relaxed', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(base, 'h-9 appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="label block">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}
