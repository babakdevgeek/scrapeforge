import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Trash2 } from 'lucide-react';
import { api, type RunStatus } from '@/lib/api';
import { useAsync, useInterval } from '@/lib/hooks';
import { ModeTag, StatusDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, ErrorNote, SkeletonRows } from '@/components/ui/states';
import { formatDuration, formatNumber, relativeTime } from '@/lib/utils';
import { toast } from '@/store/ui';

const FILTERS: (RunStatus | 'all')[] = ['all', 'running', 'success', 'failed', 'cancelled'];

export function Runs() {
  const [status, setStatus] = useState<RunStatus | 'all'>('all');
  const { data, error, loading, reload } = useAsync(
    () => api.runs({ status: status === 'all' ? undefined : status, limit: 100 }),
    [status],
  );
  useInterval(reload, 10000);

  const remove = async (id: string) => {
    try {
      await api.deleteRun(id);
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <div className="flex h-9 w-fit items-center rounded border border-line bg-raised p-0.5">
        {FILTERS.map((value) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={
              'h-8 rounded-sm px-3 text-[12.5px] capitalize transition-colors ' +
              (status === value ? 'bg-sunken text-ink' : 'text-faint hover:text-muted')
            }
          >
            {value}
          </button>
        ))}
      </div>

      {error ? <ErrorNote message={error} retry={reload} /> : null}

      <div className="panel overflow-hidden">
        {loading && !data ? (
          <SkeletonRows rows={6} cols={5} />
        ) : (data?.length ?? 0) === 0 ? (
          <Empty
            icon={<Activity className="h-5 w-5" />}
            title={status === 'all' ? 'No runs recorded' : `No ${status} runs`}
            body="Every execution keeps its logs, page count and extracted rows so you can compare them later."
          />
        ) : (
          <ul className="divide-y divide-line">
            {data!.map((run) => (
              <li key={run.id} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-sunken">
                <StatusDot status={run.status} />
                <Link to={`/runs/${run.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{run.scraper?.name ?? 'Scraper'}</span>
                  <span className="font-mono text-2xs text-faint">{run.id}</span>
                </Link>
                <ModeTag mode={run.mode} />
                <span className="tabular hidden w-24 text-right font-mono text-[12.5px] text-muted sm:block">
                  {formatNumber(run.itemCount)} items
                </span>
                <span className="tabular hidden w-16 text-right font-mono text-[12.5px] text-faint md:block">
                  {run.pages} pg
                </span>
                <span className="tabular hidden w-16 text-right font-mono text-[12.5px] text-faint md:block">
                  {formatDuration(run.durationMs)}
                </span>
                <span className="w-20 text-right text-xs text-faint">{relativeTime(run.startedAt)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => remove(run.id)}
                  title="Delete run"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
