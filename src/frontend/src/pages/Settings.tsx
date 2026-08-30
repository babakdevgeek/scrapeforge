import { Moon, Sun } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useUi } from '@/store/ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SHORTCUTS: [string, string][] = [
  ['Command palette', 'Cmd K'],
  ['Toggle theme', 'Cmd J'],
  ['Collapse sidebar', 'Cmd B'],
  ['New scraper', 'N'],
  ['Format configuration', 'Shift Alt F'],
];

export function Settings() {
  const { theme, setTheme } = useUi();
  const health = useAsync(() => api.health(), []);
  const store = useAsync(() => api.datastore(), []);

  const services: [string, string][] = [
    ['Frontend', 'http://localhost:5173'],
    ['API', 'http://localhost:3000'],
    ['API status', health.data ? health.data.status + ' / ' + health.data.dataStore : health.error ? 'unreachable' : 'checking'],
    ['App database', 'Prisma + SQLite (src/backend/prisma)'],
    ['Data store', store.data ? store.data.driver + ' / ' + store.data.tables.length + ' table(s)' : 'checking'],
  ];

  return (
    <div className="mx-auto max-w-[820px] space-y-6">
      <section className="panel p-5">
        <h2 className="text-[13.5px] font-semibold">Appearance</h2>
        <p className="mt-1 text-[13px] text-muted">
          Light is a clean neutral surface. Dark is Dracula, applied to every panel, table, chart and the editor itself.
        </p>
        <div className="mt-4 flex gap-2">
          {(['light', 'dark'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setTheme(option)}
              className={cn(
                'flex flex-1 items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors',
                theme === option ? 'border-accent bg-[color:var(--accent)]/6' : 'border-line hover:bg-sunken',
              )}
            >
              {option === 'light' ? <Sun className="h-4 w-4 text-accent" /> : <Moon className="h-4 w-4 text-accent" />}
              <span>
                <span className="block text-[13.5px] font-medium capitalize">{option}</span>
                <span className="block text-xs text-muted">
                  {option === 'light' ? 'Neutral, violet-tinted' : 'Dracula palette'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13.5px] font-semibold">Local services</h2>
        </div>
        <dl className="divide-y divide-line text-[13px]">
          {services.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 px-5 py-2.5">
              <dt className="text-muted">{label}</dt>
              <dd className="font-mono text-[12.5px]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel p-5">
        <h2 className="text-[13.5px] font-semibold">Keyboard</h2>
        <dl className="mt-3 space-y-2 text-[13px]">
          {SHORTCUTS.map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between">
              <dt className="text-muted">{label}</dt>
              <dd className="font-mono text-2xs text-faint">{keys}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel p-5">
        <h2 className="text-[13.5px] font-semibold">Switching to PostgreSQL</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Set DATA_STORE_DRIVER=postgres and DATA_STORE_POSTGRES_URL in .env, install the optional pg package, then
          restart the API. Individual scrapers can also target a driver through output.driver.
        </p>
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => health.reload()}>
            Re-check services
          </Button>
        </div>
      </section>
    </div>
  );
}
