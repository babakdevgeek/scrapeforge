import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleStop, Database, RotateCw } from 'lucide-react';
import { api, type Run } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { LogConsole, type LogItem } from '@/components/LogConsole';
import { Progress } from '@/components/ActivityChart';
import { ModeTag, StatusDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorNote, Loading } from '@/components/ui/states';
import { formatDuration, formatNumber, truncate } from '@/lib/utils';
import { toast } from '@/store/ui';

interface Telemetry {
  page: number;
  totalPages?: number;
  items: number;
  phase: string;
}

/** Live runner: SSE feeds logs, progress and the first rows as they land. */
export function RunView() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.runDetail(id), [id]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState<Run['status'] | null>(null);

  useEffect(() => {
    if (data?.logs) setLogs(data.logs.map(({ level, message, ts }) => ({ level, message, ts })));
    if (data) setStatus(data.status);
  }, [data]);

  useEffect(() => {
    if (!id) return;
    const source = new EventSource(api.streamUrl(id));

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as
        | { type: 'log'; level: LogItem['level']; message: string; ts: string }
        | { type: 'progress'; page: number; totalPages?: number; items: number; phase: string }
        | { type: 'items'; items: Record<string, unknown>[] }
        | { type: 'status'; status: Run['status'] }
        | { type: 'done' };

      if (payload.type === 'log') {
        setLogs((current) => [...current.slice(-600), { level: payload.level, message: payload.message, ts: payload.ts }]);
      } else if (payload.type === 'progress') {
        setTelemetry(payload);
      } else if (payload.type === 'items') {
        setPreview((current) => [...payload.items, ...current].slice(0, 40));
      } else if (payload.type === 'status') {
        setStatus(payload.status);
      } else if (payload.type === 'done') {
        source.close();
        reload();
      }
    };

    source.onerror = () => source.close();
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    preview.slice(0, 12).forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return [...keys].slice(0, 6);
  }, [preview]);

  if (loading && !data) return <Loading label="Loading run" />;
  if (error) return <ErrorNote message={error} retry={reload} />;
  if (!data) return null;

  const live = status === 'running';
  const pages = telemetry?.totalPages ?? data.totalPages ?? 0;
  const page = telemetry?.page ?? data.pages;
  const items = telemetry?.items ?? data.itemCount;
  const percent = live && pages ? Math.min(100, Math.round((page / pages) * 100)) : status === 'success' ? 100 : 0;

  const cancel = async () => {
    try {
      await api.cancelRun(id);
      toast('Cancelling after the current page', 'info');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <header className="panel px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusDot status={status ?? data.status} label />
          <Link to={`/scrapers/${data.scraperId}`} className="font-display text-[16px] font-semibold hover:text-accent">
            {data.scraper?.name ?? 'Scraper'}
          </Link>
          <ModeTag mode={data.mode} />
          <div className="ml-auto flex items-center gap-2">
            {live ? (
              <Button size="sm" variant="danger" onClick={cancel}>
                <CircleStop className="h-3.5 w-3.5" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const started = await api.run(data.scraperId);
                  window.location.href = `/runs/${started.id}`;
                }}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Run again
              </Button>
            )}
            <Link to={`/data?scraper=${data.scraperId}`}>
              <Button size="sm" variant="secondary">
                <Database className="h-3.5 w-3.5" />
                Records
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[12.5px]">
            <span className="text-muted">
              page <span className="tabular text-ink">{page}</span>
              {pages ? <span className="text-faint">/{pages}</span> : null}
            </span>
            <span className="text-muted">
              found <span className="tabular text-ink">{formatNumber(items)}</span> items
            </span>
            <span className="text-muted">
              errors <span className="tabular text-ink">{data.errorCount}</span>
            </span>
            <span className="text-muted">
              elapsed <span className="tabular text-ink">{formatDuration(data.durationMs)}</span>
            </span>
            <span className="ml-auto text-faint">{telemetry?.phase ?? (live ? 'Working' : 'Finished')}</span>
          </div>
          <Progress value={percent} tone={status === 'failed' ? 'danger' : status === 'success' ? 'ok' : 'accent'} />
        </div>

        {data.error ? <p className="mt-3 code text-danger">{data.error}</p> : null}
      </header>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <LogConsole logs={logs} height={380} />

        <div className="panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="label">Extracted items</p>
            <span className="tabular text-xs text-faint">{preview.length} shown</span>
          </header>
          {preview.length === 0 ? (
            <p className="px-4 py-14 text-center text-[13px] text-muted">
              {live ? 'Waiting for the first rows\u2026' : 'Open Records to browse everything this run stored.'}
            </p>
          ) : (
            <div className="max-h-[340px] overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 bg-raised">
                  <tr className="border-b border-line">
                    {columns.map((column) => (
                      <th key={column} className="label whitespace-nowrap px-3 py-2 font-mono">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr key={index} className="border-b border-line last:border-b-0">
                      {columns.map((column) => (
                        <td key={column} className="max-w-[220px] truncate px-3 py-2 text-[12.5px]">
                          {truncate(row[column], 60)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
