import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { Activity, Database, Gauge, HardDrive, Moon, Play, Plus, Search, Table2 } from 'lucide-react';
import { api, type Scraper } from '@/lib/api';
import { useUi, toast } from '@/store/ui';
import { ModeTag } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Action {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const { paletteOpen, setPalette, toggleTheme } = useUi();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [scrapers, setScrapers] = useState<Scraper[]>([]);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!paletteOpen) return;
    setQuery('');
    setCursor(0);
    api
      .scrapers()
      .then(setScrapers)
      .catch(() => setScrapers([]));
  }, [paletteOpen]);

  const actions = useMemo<Action[]>(() => {
    const go = (path: string) => () => {
      navigate(path);
      setPalette(false);
    };

    const base: Action[] = [
      { id: 'new', label: 'Create scraper', hint: 'n', icon: <Plus className="h-4 w-4" />, run: go('/scrapers/new') },
      { id: 'overview', label: 'Overview', icon: <Gauge className="h-4 w-4" />, run: go('/') },
      { id: 'scrapers', label: 'All scrapers', icon: <Table2 className="h-4 w-4" />, run: go('/scrapers') },
      { id: 'runs', label: 'Run history', icon: <Activity className="h-4 w-4" />, run: go('/runs') },
      { id: 'records', label: 'Records', icon: <Database className="h-4 w-4" />, run: go('/data') },
      { id: 'store', label: 'Data store', icon: <HardDrive className="h-4 w-4" />, run: go('/store') },
      {
        id: 'theme',
        label: 'Toggle theme',
        hint: '⌘J',
        icon: <Moon className="h-4 w-4" />,
        run: () => {
          toggleTheme();
          setPalette(false);
        },
      },
    ];

    const scraperActions: Action[] = scrapers.flatMap((scraper) => [
      {
        id: 'open-' + scraper.id,
        label: scraper.name,
        hint: 'edit',
        icon: <ModeTag mode={scraper.mode} />,
        run: go('/scrapers/' + scraper.id),
      },
      {
        id: 'run-' + scraper.id,
        label: 'Run ' + scraper.name,
        icon: <Play className="h-4 w-4" />,
        run: async () => {
          setPalette(false);
          try {
            const run = await api.run(scraper.id);
            navigate('/runs/' + run.id);
          } catch (error) {
            toast((error as Error).message, 'error');
          }
        },
      },
    ]);

    return [...base, ...scraperActions];
  }, [navigate, scrapers, setPalette, toggleTheme]);

  const results = useMemo(() => {
    if (!query.trim()) return actions.slice(0, 9);
    const needle = query.toLowerCase();
    return actions.filter((action) => action.label.toLowerCase().includes(needle)).slice(0, 12);
  }, [actions, query]);

  return (
    <Dialog.Root open={paletteOpen} onOpenChange={setPalette}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[color:var(--sunken)]/72 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setCursor((current) => Math.min(current + 1, results.length - 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setCursor((current) => Math.max(current - 1, 0));
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              results[cursor]?.run();
            }
          }}
          className="fixed left-1/2 top-[14vh] z-50 w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-raised shadow-[var(--shadow-panel)] data-[state=open]:animate-fade-rise"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-line px-4">
            <Search className="h-4 w-4 text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
              }}
              placeholder="Search scrapers or run a command"
              className="h-12 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
            />
          </div>

          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">Nothing matches that.</p>
          ) : (
            <ul className="max-h-[52vh] overflow-y-auto p-1.5">
              {results.map((action, index) => (
                <li key={action.id}>
                  <button
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => action.run()}
                    className={cn(
                      'flex w-full items-center gap-3 rounded px-2.5 py-2 text-left text-[13.5px] transition-colors',
                      index === cursor ? 'bg-sunken text-ink' : 'text-muted',
                    )}
                  >
                    <span className="flex h-5 w-9 items-center justify-start text-faint">{action.icon}</span>
                    <span className="flex-1 truncate">{action.label}</span>
                    {action.hint ? <span className="font-mono text-2xs text-faint">{action.hint}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <footer className="flex items-center gap-4 border-t border-line px-4 py-2 text-2xs text-faint">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
