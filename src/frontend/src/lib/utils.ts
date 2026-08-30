import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDuration(ms: number | null | undefined) {
  if (!ms) return '\u2014';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function relativeTime(input: string | Date | null | undefined) {
  if (!input) return 'never';
  const date = typeof input === 'string' ? new Date(input) : input;
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  if (diff < minute) return 'just now';
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}m ago`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}h ago`;
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function truncate(value: unknown, length = 90) {
  const text = typeof value === 'string' ? value : value === null || value === undefined ? '' : JSON.stringify(value);
  return text.length > length ? `${text.slice(0, length)}\u2026` : text;
}

export function download(filename: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function safeParse<T = unknown>(value: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(value) as T };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
