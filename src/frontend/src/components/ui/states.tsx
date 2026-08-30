import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Empty({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
      {icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-line bg-sunken text-faint">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 px-6 py-16 text-[13px] text-muted', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNote({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--danger)]/45 bg-[color:var(--danger)]/8 px-4 py-3 text-[13px]">
      <span className="text-danger">{message}</span>
      {retry ? (
        <button onClick={retry} className="font-medium text-danger underline underline-offset-4">
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Skeleton rows for tables while the first page loads. */
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((__, colIndex) => (
            <div
              key={colIndex}
              className="h-3 rounded-sm bg-sunken animate-pulse"
              style={{ width: `${[34, 12, 18, 14, 10][colIndex % 5]}%`, animationDelay: `${(rowIndex * cols + colIndex) * 40}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
