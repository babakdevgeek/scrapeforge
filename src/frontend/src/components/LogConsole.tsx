import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface LogItem {
  level: 'debug' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  ts: string;
}

const LEVEL_COLOR: Record<LogItem['level'], string> = {
  debug: 'text-faint',
  info: 'text-muted',
  warn: 'text-warn',
  error: 'text-danger',
  success: 'text-ok',
};

const LEVELS: (LogItem['level'] | 'all')[] = ['all', 'info', 'success', 'warn', 'error', 'debug'];

/** Terminal-flavoured log view with level filtering and sticky autoscroll. */
export function LogConsole({ logs, height = 320 }: { logs: LogItem[]; height?: number }) {
  const [filter, setFilter] = useState<(typeof LEVELS)[number]>('all');
  const [follow, setFollow] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const visible = filter === 'all' ? logs : logs.filter((log) => log.level === filter);

  useEffect(() => {
    if (follow) endRef.current?.scrollIntoView({ block: 'end' });
  }, [visible.length, follow]);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-sunken">
      <div className="flex items-center gap-1 border-b border-line px-2.5 py-1.5">
        {LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={cn(
              'rounded-sm px-1.5 py-0.5 font-mono text-2xs uppercase transition-colors',
              filter === level ? 'bg-raised text-ink' : 'text-faint hover:text-muted',
            )}
          >
            {level}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer select-none items-center gap-1.5 text-2xs text-faint">
          <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} className="accent-[color:var(--accent)]" />
          follow
        </label>
      </div>

      <div className="overflow-y-auto px-3 py-2.5" style={{ height }} onWheel={() => setFollow(false)}>
        {visible.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-faint">No log lines{filter === 'all' ? ' yet' : ` at ${filter} level`}.</p>
        ) : (
          <ol className="space-y-[3px]">
            {visible.map((log, index) => (
              <li key={`${log.ts}-${index}`} className="flex gap-3 font-mono text-[12px] leading-relaxed">
                <span className="shrink-0 text-faint">{new Date(log.ts).toLocaleTimeString([], { hour12: false })}</span>
                <span className={cn('w-[52px] shrink-0 uppercase', LEVEL_COLOR[log.level])}>{log.level}</span>
                <span className="min-w-0 break-words text-ink/90">{log.message}</span>
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
