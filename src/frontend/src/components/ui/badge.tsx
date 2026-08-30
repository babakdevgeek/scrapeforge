import { cn } from '@/lib/utils';
import type { Mode, RunStatus } from '@/lib/api';

const MODE_STYLE: Record<Mode, string> = {
  html: 'text-accent bg-[color:var(--accent)]/12',
  api: 'text-info bg-[color:var(--info)]/12',
  browser: 'text-pink bg-[color:var(--pink)]/12',
};

export function ModeTag({ mode, className }: { mode: Mode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-2xs font-medium uppercase',
        MODE_STYLE[mode] ?? MODE_STYLE.html,
        className,
      )}
    >
      {mode}
    </span>
  );
}

const STATUS_COLOR: Record<RunStatus, string> = {
  queued: 'bg-faint',
  running: 'bg-accent',
  success: 'bg-ok',
  failed: 'bg-danger',
  cancelled: 'bg-warn',
};

export function StatusDot({ status, label }: { status: RunStatus; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-2 w-2 shrink-0">
        {status === 'running' ? (
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse', STATUS_COLOR[status])} />
        ) : null}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', STATUS_COLOR[status])} />
      </span>
      {label ? <span className="text-[13px] capitalize text-muted">{status}</span> : null}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('rounded-sm border border-line px-1.5 py-0.5 text-2xs text-muted', className)}>{children}</span>
  );
}
