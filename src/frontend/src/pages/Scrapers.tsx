import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Download, MoreHorizontal, Pencil, Play, Plus, Search, Trash2, Upload, Zap } from 'lucide-react';
import { api, type Example, type Mode, type Scraper } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { ModeTag, StatusDot, Tag } from '@/components/ui/badge';
import { Empty, ErrorNote, SkeletonRows } from '@/components/ui/states';
import { download, formatNumber, relativeTime, safeParse } from '@/lib/utils';
import { toast } from '@/store/ui';

const MODES: (Mode | 'all')[] = ['all', 'html', 'api', 'browser'];

export function Scrapers() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(() => api.scrapers(), []);
  const examples = useAsync(() => api.examples(), []);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode | 'all'>('all');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Scraper | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const scrapers = useMemo(() => {
    const list = data ?? [];
    const needle = query.trim().toLowerCase();
    return list.filter(
      (scraper) =>
        (mode === 'all' || scraper.mode === mode) &&
        (!needle || scraper.name.toLowerCase().includes(needle) || (scraper.description ?? '').toLowerCase().includes(needle)),
    );
  }, [data, mode, query]);

  const run = async (scraper: Scraper) => {
    setBusy(scraper.id);
    try {
      const started = await api.run(scraper.id);
      navigate(`/runs/${started.id}`);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async (scraper: Scraper) => {
    try {
      await api.duplicateScraper(scraper.id);
      toast(`Duplicated ${scraper.name}`, 'ok');
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const remove = async (scraper: Scraper) => {
    try {
      await api.deleteScraper(scraper.id);
      toast(`Deleted ${scraper.name}`, 'ok');
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const loadExample = async (example: Example) => {
    try {
      await api.createScraper({ name: example.name, description: example.description, config: example.config });
      toast(`Added ${example.name}`, 'ok');
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const runImport = async () => {
    const parsed = safeParse<unknown>(importText);
    if (!parsed.ok) return toast(`Invalid JSON: ${parsed.error}`, 'error');

    const raw = parsed.value;
    const entries = Array.isArray(raw)
      ? (raw as { name?: string; config?: unknown }[])
      : [(raw as { config?: unknown; name?: string })];
    const configs = entries.map((entry) =>
      entry && typeof entry === 'object' && 'config' in entry
        ? { name: entry.name, config: (entry as { config: unknown }).config }
        : { name: undefined, config: entry },
    );

    try {
      const result = await api.importScrapers(configs);
      toast(`Imported ${result.created.length} scraper${result.created.length === 1 ? '' : 's'}`, 'ok');
      if (result.failed.length) toast(`${result.failed.length} config rejected`, 'error');
      setImportOpen(false);
      setImportText('');
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded border border-line bg-raised px-3 focus-within:border-accent">
          <Search className="h-3.5 w-3.5 shrink-0 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter scrapers"
            className="h-full w-full bg-transparent text-[13.5px] placeholder:text-faint focus:outline-none"
          />
        </div>

        <div className="flex h-9 items-center rounded border border-line bg-raised p-0.5">
          {MODES.map((value) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={
                'h-8 rounded-sm px-2.5 font-mono text-2xs uppercase transition-colors ' +
                (mode === value ? 'bg-sunken text-ink' : 'text-faint hover:text-muted')
              }
            >
              {value}
            </button>
          ))}
        </div>

        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
        <Button variant="primary" onClick={() => navigate('/scrapers/new')}>
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      {error ? <ErrorNote message={error} retry={reload} /> : null}

      <div className="panel overflow-hidden">
        {loading ? (
          <SkeletonRows rows={5} cols={5} />
        ) : scrapers.length === 0 ? (
          <Empty
            icon={<Zap className="h-5 w-5" />}
            title={data?.length ? 'No scraper matches that filter' : 'No scrapers yet'}
            body={
              data?.length
                ? 'Try a different name or mode.'
                : 'Build one from scratch, or start from a bundled example below and edit the JSON.'
            }
            action={
              data?.length ? null : (
                <Button variant="primary" size="sm" onClick={() => navigate('/scrapers/new')}>
                  <Plus className="h-3.5 w-3.5" />
                  New scraper
                </Button>
              )
            }
          />
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {['Name', 'Mode', 'Last execution', 'Status', 'Records', ''].map((heading) => (
                  <th key={heading} className="label whitespace-nowrap px-4 py-2.5 first:pl-5 last:w-12">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scrapers.map((scraper) => (
                <tr key={scraper.id} className="group border-b border-line transition-colors last:border-b-0 hover:bg-sunken">
                  <td className="px-4 py-3 pl-5">
                    <Link to={`/scrapers/${scraper.id}`} className="block">
                      <span className="text-[13.5px] font-medium">{scraper.name}</span>
                      {scraper.description ? (
                        <span className="mt-0.5 block max-w-lg truncate text-xs text-muted">{scraper.description}</span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ModeTag mode={scraper.mode} />
                  </td>
                  <td className="px-4 py-3 text-[13px] text-muted">{relativeTime(scraper.lastRun?.startedAt)}</td>
                  <td className="px-4 py-3">
                    {scraper.lastRun ? (
                      <StatusDot status={scraper.lastRun.status} label />
                    ) : (
                      <span className="text-[13px] text-faint">never run</span>
                    )}
                  </td>
                  <td className="tabular px-4 py-3 font-mono text-[12.5px]">{formatNumber(scraper.records)}</td>
                  <td className="px-4 py-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Run now"
                        loading={busy === scraper.id}
                        onClick={() => run(scraper)}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Menu>
                        <MenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem onSelect={() => navigate(`/scrapers/${scraper.id}`)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </MenuItem>
                          <MenuItem onSelect={() => duplicate(scraper)}>
                            <Copy className="h-3.5 w-3.5" />
                            Duplicate
                          </MenuItem>
                          <MenuItem
                            onSelect={() =>
                              download(
                                `${scraper.name.replace(/\W+/g, '-').toLowerCase()}.json`,
                                JSON.stringify({ name: scraper.name, description: scraper.description, config: scraper.config }, null, 2),
                              )
                            }
                          >
                            <Download className="h-3.5 w-3.5" />
                            Export config
                          </MenuItem>
                          <MenuItem onSelect={() => navigate(`/data?scraper=${scraper.id}`)}>
                            <Download className="h-3.5 w-3.5" />
                            View records
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem tone="danger" onSelect={() => setConfirmDelete(scraper)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {examples.data?.length && (data?.length ?? 0) < 4 ? (
        <section className="space-y-2.5">
          <h2 className="text-[13.5px] font-semibold">Bundled examples</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {examples.data.map((example) => (
              <button
                key={example.slug}
                onClick={() => loadExample(example)}
                className="flex flex-col gap-1.5 rounded-md border border-line bg-raised px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-sunken"
              >
                <span className="flex items-center gap-2">
                  <ModeTag mode={example.mode} />
                  <span className="text-[13.5px] font-medium">{example.name}</span>
                </span>
                <span className="text-xs leading-relaxed text-muted">{example.description}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import configuration"
        description="Paste one config, an array of configs, or an exported ScrapeForge file."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={runImport}>
              Import
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <input
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) setImportText(await file.text());
            }}
            className="block w-full text-[13px] text-muted file:mr-3 file:rounded file:border file:border-line file:bg-raised file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
          />
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={12}
            placeholder='{"mode":"html", "target":{"url":"..."}, "item":{...}}'
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name ?? ''}?`}
        description="Runs, logs and stored records for this scraper go with it. Rows already written to a destination table stay."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>
              Delete scraper
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2 text-[13px] text-muted">
          <Tag>{formatNumber(confirmDelete?.records)} records</Tag>
          <Tag>{confirmDelete?.runCount ?? 0} runs</Tag>
          <Tag>{confirmDelete?.versionCount ?? 0} versions</Tag>
        </div>
      </Modal>
    </div>
  );
}
