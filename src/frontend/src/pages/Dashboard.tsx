import { Link } from 'react-router-dom';
import { ArrowUpRight, Boxes, Clock, Plus, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync, useInterval } from '@/lib/hooks';
import { ActivityChart } from '@/components/ActivityChart';
import { ModeTag, StatusDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, ErrorNote, Loading } from '@/components/ui/states';
import { formatDuration, formatNumber, relativeTime } from '@/lib/utils';

export function Dashboard() {
  const { data, error, loading, reload } = useAsync(() => api.stats(), []);
  useInterval(reload, 15000);

  if (loading && !data) return <Loading label="Reading the workspace" />;
  if (error) return <ErrorNote message={error} retry={reload} />;
  if (!data) return null;

  const { totals, timeline, recentRuns, byMode } = data;
  const runsTotal = totals.success + totals.failed;
  const successRate = runsTotal ? Math.round((totals.success / runsTotal) * 100) : null;

  return (
    <div className="mx-auto max-w-[1180px] space-y-7">
      <section className="panel overflow-hidden">
        <div className="grid divide-line sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
          <div className="px-5 py-5 lg:px-6">
            <p className="label">Stored records</p>
            <p className="tabular mt-2 font-display text-[34px] font-semibold leading-none">
              {formatNumber(totals.records)}
            </p>
            <p className="mt-2 text-xs text-muted">
              across {totals.scrapers} scraper{totals.scrapers === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex flex-col justify-center gap-2.5 border-t border-line px-5 py-5 sm:border-t-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-muted">Successful runs</span>
              <span className="tabular font-mono text-[15px] text-ok">{formatNumber(totals.success)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-muted">Failed runs</span>
              <span className="tabular font-mono text-[15px] text-danger">{formatNumber(totals.failed)}</span>
            </div>
            {successRate !== null ? (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-muted">Success rate</span>
                <span className="tabular font-mono text-[15px]">{successRate}%</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col justify-center gap-2.5 border-t border-line px-5 py-5 lg:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                <Clock className="h-3.5 w-3.5 text-faint" />
                Average run
              </span>
              <span className="tabular font-mono text-[15px]">{formatDuration(totals.avgDuration)}</span>
            </div>
            {byMode.length ? (
              <div className="flex flex-wrap gap-1.5">
                {byMode.map((entry) => (
                  <span key={entry.mode} className="flex items-center gap-1.5">
                    <ModeTag mode={entry.mode} />
                    <span className="tabular text-xs text-faint">{entry.count}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-faint">No scrapers yet</p>
            )}
          </div>

          <div className="border-t border-line px-5 py-5 lg:border-t-0">
            <p className="label">Items scraped, last 14 days</p>
            <div className="mt-3">
              <ActivityChart data={timeline} height={92} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[13.5px] font-semibold">Recent activity</h2>
            <Link to="/runs" className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent">
              All runs
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </header>

          {recentRuns.length === 0 ? (
            <Empty
              icon={<Sparkles className="h-5 w-5" />}
              title="Nothing has run yet"
              body="Create a scraper or load one of the bundled examples, then hit run. Live logs show up here."
              action={
                <Link to="/scrapers/new">
                  <Button variant="primary" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    New scraper
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {recentRuns.map((run) => (
                <li key={run.id}>
                  <Link
                    to={`/runs/${run.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-sunken"
                  >
                    <StatusDot status={run.status} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{run.scraper}</span>
                    <ModeTag mode={run.mode} />
                    <span className="tabular hidden w-20 text-right font-mono text-[12.5px] text-muted sm:block">
                      {formatNumber(run.itemCount)} items
                    </span>
                    <span className="tabular hidden w-16 text-right font-mono text-[12.5px] text-faint md:block">
                      {formatDuration(run.durationMs)}
                    </span>
                    <span className="w-20 text-right text-xs text-faint">{relativeTime(run.startedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="panel p-5">
            <h2 className="text-[13.5px] font-semibold">Start something</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Three engines, one config format. Pick the cheapest one that works: HTML beats browser every time.
            </p>
            <div className="mt-4 space-y-2">
              <Link
                to="/scrapers/new"
                className="flex items-center justify-between rounded border border-line px-3 py-2.5 text-[13px] transition-colors hover:border-line-strong hover:bg-sunken"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5 text-accent" />
                  Build a scraper
                </span>
                <kbd className="font-mono text-2xs text-faint">n</kbd>
              </Link>
              <Link
                to="/scrapers"
                className="flex items-center justify-between rounded border border-line px-3 py-2.5 text-[13px] transition-colors hover:border-line-strong hover:bg-sunken"
              >
                <span className="flex items-center gap-2">
                  <Boxes className="h-3.5 w-3.5 text-accent" />
                  Load an example config
                </span>
                <ArrowUpRight className="h-3 w-3 text-faint" />
              </Link>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-[13.5px] font-semibold">Shortcuts</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              {[
                ['Command palette', 'Cmd K'],
                ['Toggle theme', 'Cmd J'],
                ['Collapse sidebar', 'Cmd B'],
                ['New scraper', 'N'],
              ].map(([label, keys]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-mono text-2xs text-faint">{keys}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
