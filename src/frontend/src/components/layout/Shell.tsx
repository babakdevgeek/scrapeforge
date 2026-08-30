import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Database,
  Gauge,
  HardDrive,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings as SettingsIcon,
  Sun,
  Table2,
} from 'lucide-react';
import { useUi } from '@/store/ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { CommandPalette } from '@/components/layout/CommandPalette';

const NAV = [
  { to: '/', label: 'Overview', icon: Gauge, exact: true },
  { to: '/scrapers', label: 'Scrapers', icon: Table2 },
  { to: '/runs', label: 'Runs', icon: Activity },
  { to: '/data', label: 'Records', icon: Database },
  { to: '/store', label: 'Data store', icon: HardDrive },
];

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/scrapers': 'Scrapers',
  '/scrapers/new': 'New scraper',
  '/runs': 'Runs',
  '/data': 'Records',
  '/store': 'Data store',
  '/settings': 'Settings',
};

export function Shell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar, setPalette } = useUi();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const element = event.target as HTMLElement | null;
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? '') || Boolean(element?.isContentEditable);

      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette(true);
        return;
      }
      if (mod && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        toggleTheme();
        return;
      }
      if (mod && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
        return;
      }
      if (!mod && !typing && event.key === 'n') {
        event.preventDefault();
        navigate('/scrapers/new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, setPalette, toggleSidebar, toggleTheme]);

  const title = TITLES[location.pathname] ?? (location.pathname.startsWith('/runs/') ? 'Run detail' : 'Scraper');

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cn(
          'sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-line bg-raised transition-[width] duration-300 ease-out lg:flex',
          sidebarCollapsed ? 'w-[62px]' : 'w-[228px]',
        )}
      >
        <div className="flex h-14 items-center gap-2.5 px-4">
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" aria-hidden>
            <path d="M4 6.5 12 2l8 4.5v11L12 22l-8-4.5v-11Z" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
            <path d="M8 12h8M12 8.5v7" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {!sidebarCollapsed ? (
            <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">ScrapeForge</span>
          ) : null}
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {!sidebarCollapsed ? <p className="label px-2 pb-2 pt-1">Workspace</p> : null}
          {NAV.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              title={label}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-2.5 rounded px-2.5 text-[13.5px] transition-colors duration-150 ease-out',
                  isActive ? 'bg-sunken font-medium text-ink' : 'text-muted hover:bg-sunken hover:text-ink',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {!sidebarCollapsed ? label : null}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-line p-2">
          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2.5 rounded px-2.5 text-[13.5px] transition-colors',
                isActive ? 'bg-sunken text-ink' : 'text-muted hover:bg-sunken hover:text-ink',
              )
            }
          >
            <SettingsIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {!sidebarCollapsed ? 'Settings' : null}
          </NavLink>
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-full items-center gap-2.5 rounded px-2.5 text-[13.5px] text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!sidebarCollapsed ? 'Collapse' : null}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-[color:var(--bg)]/88 px-4 backdrop-blur-sm sm:px-6">
          <h1 className="font-display text-[15px] font-semibold">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPalette(true)}
              className="hidden h-8 items-center gap-2 rounded border border-line px-2.5 text-[12.5px] text-faint transition-colors hover:border-line-strong hover:text-muted sm:flex"
            >
              Jump to
              <kbd className="font-mono text-2xs">⌘K</kbd>
            </button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme (⌘J)">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/scrapers/new')}>
              <Plus className="h-3.5 w-3.5" />
              New scraper
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">{children}</main>

        <nav className="sticky bottom-0 z-20 flex border-t border-line bg-raised lg:hidden">
          {NAV.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-2xs', isActive ? 'text-accent' : 'text-faint')
              }
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <CommandPalette />
      <Toaster />
    </div>
  );
}
