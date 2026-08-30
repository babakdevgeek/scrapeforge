import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface DayPoint {
  date: string;
  runs: number;
  items: number;
  failed: number;
}

/** Hand-drawn SVG so the chart inherits the theme tokens instead of fighting them. */
export function ActivityChart({ data, height = 132 }: { data: DayPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = Math.max(1, ...data.map((day) => day.items));
  const width = 100;
  const gap = 1.6;
  const barWidth = (width - gap * (data.length - 1)) / data.length;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" style={{ height }} className="w-full">
        {[10, 20, 30].map((y) => (
          <line key={y} x1="0" x2={width} y1={y} y2={y} stroke="var(--line)" strokeWidth="0.25" />
        ))}
        {data.map((day, index) => {
          const value = (day.items / peak) * 36;
          const x = index * (barWidth + gap);
          const failedShare = day.runs ? day.failed / day.runs : 0;
          return (
            <g key={day.date} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={0} width={barWidth} height={40} fill="transparent" />
              <rect
                x={x}
                y={40 - Math.max(value, day.runs ? 1.2 : 0)}
                width={barWidth}
                height={Math.max(value, day.runs ? 1.2 : 0)}
                rx={0.8}
                fill={failedShare > 0.4 ? 'var(--danger)' : 'var(--accent)'}
                opacity={hover === null || hover === index ? 0.92 : 0.4}
                className="transition-opacity duration-200"
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-between text-2xs text-faint">
        <span>{data[0]?.date.slice(5)}</span>
        <span className={cn('transition-opacity', hover === null ? 'opacity-0' : 'opacity-100')}>
          {hover !== null
            ? `${data[hover].date.slice(5)} \u00b7 ${data[hover].items} items \u00b7 ${data[hover].runs} run${data[hover].runs === 1 ? '' : 's'}`
            : ''}
        </span>
        <span>today</span>
      </div>
    </figure>
  );
}

/** Compact progress bar used by the runner. */
export function Progress({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'ok' | 'danger' }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          tone === 'accent' && 'bg-accent',
          tone === 'ok' && 'bg-ok',
          tone === 'danger' && 'bg-danger',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
