import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, Search } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { Empty, SkeletonRows } from '@/components/ui/states';
import { cn, truncate } from '@/lib/utils';

export interface DataTableProps {
  rows: Record<string, unknown>[];
  columns: string[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  search: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  onSearch: (value: string) => void;
  onSort: (column: string) => void;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  exportHref?: (format: 'json' | 'csv' | 'xlsx', columns: string[]) => string;
  emptyTitle?: string;
  emptyBody?: string;
}

export function DataTable({
  rows,
  columns,
  total,
  page,
  pageSize,
  loading,
  search,
  sort,
  dir = 'asc',
  onSearch,
  onSort,
  onPage,
  onPageSize,
  exportHref,
  emptyTitle = 'No records yet',
  emptyBody = 'Run a scraper and its rows land here.',
}: DataTableProps) {
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = useMemo(() => columns.filter((column) => !hidden.includes(column)), [columns, hidden]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <div className="flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded border border-line bg-raised px-2.5 focus-within:border-accent">
          <Search className="h-3.5 w-3.5 shrink-0 text-faint" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search every column"
            className="h-full w-full bg-transparent text-[13px] placeholder:text-faint focus:outline-none"
          />
        </div>

        <span className="tabular hidden px-1 text-xs text-faint sm:block">{total.toLocaleString()} rows</span>

        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="secondary">
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </MenuTrigger>
          <MenuContent className="max-h-[320px] overflow-y-auto">
            <MenuLabel>Visible columns</MenuLabel>
            {columns.map((column) => (
              <MenuItem
                key={column}
                onSelect={() =>
                  setHidden((current) =>
                    current.includes(column) ? current.filter((c) => c !== column) : [...current, column],
                  )
                }
              >
                <span className={cn('font-mono text-[12.5px]', hidden.includes(column) ? 'text-faint line-through' : 'text-ink')}>
                  {column}
                </span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>

        {exportHref ? (
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="secondary">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Download {total.toLocaleString()} rows</MenuLabel>
              <MenuItem onSelect={() => window.open(exportHref('json', visible), '_blank')}>JSON</MenuItem>
              <MenuItem onSelect={() => window.open(exportHref('csv', visible), '_blank')}>CSV</MenuItem>
              <MenuItem onSelect={() => window.open(exportHref('xlsx', visible), '_blank')}>Excel</MenuItem>
              <MenuSeparator />
              <MenuLabel>Visible columns only</MenuLabel>
            </MenuContent>
          </Menu>
        ) : null}
      </div>

      {loading ? (
        <SkeletonRows rows={8} cols={Math.min(5, Math.max(2, visible.length))} />
      ) : rows.length === 0 ? (
        <Empty title={emptyTitle} body={emptyBody} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {visible.map((column) => {
                  const active = sort === column;
                  return (
                    <th key={column} className="whitespace-nowrap bg-raised px-4 py-2.5 first:pl-5">
                      <button
                        onClick={() => onSort(column)}
                        className={cn(
                          'flex items-center gap-1 font-mono text-2xs uppercase transition-colors',
                          active ? 'text-accent' : 'text-faint hover:text-muted',
                        )}
                      >
                        {column}
                        {active ? (
                          dir === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={String(row._id ?? index)}
                  className="border-b border-line transition-colors last:border-b-0 hover:bg-sunken"
                >
                  {visible.map((column) => (
                    <td key={column} className="max-w-[380px] px-4 py-2.5 align-top text-[13px] first:pl-5">
                      <span className={cn(typeof row[column] === 'number' && 'tabular font-mono text-[12.5px]')}>
                        {truncate(row[column], 140) || <span className="text-faint">\u2014</span>}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5">
          <span className="tabular text-xs text-faint">
            {(page - 1) * pageSize + 1}\u2013{Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </span>

          {onPageSize ? (
            <select
              value={pageSize}
              onChange={(event) => onPageSize(Number(event.target.value))}
              className="h-7 rounded border border-line bg-raised px-1.5 text-xs text-muted"
            >
              {[25, 50, 100, 250].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            <Button size="icon" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular px-1 text-xs text-muted">
              {page} / {pages}
            </span>
            <Button size="icon" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
