import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useUi } from '@/store/ui';
import { cn } from '@/lib/utils';

const ICONS = {
  ok: <CheckCircle2 className="h-4 w-4 text-ok" />,
  error: <XCircle className="h-4 w-4 text-danger" />,
  info: <Info className="h-4 w-4 text-accent" />,
};

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(360px,88vw)] flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 rounded-md border border-line bg-raised px-3.5 py-3 text-left text-[13px] leading-snug shadow-[var(--shadow-panel)] animate-fade-rise',
          )}
        >
          <span className="mt-0.5">{ICONS[toast.tone]}</span>
          <span className="text-ink">{toast.message}</span>
        </button>
      ))}
    </div>
  );
}
