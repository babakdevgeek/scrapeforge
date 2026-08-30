import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Trash2 } from 'lucide-react';
import { api, type Scraper } from '@/lib/api';
import { useAsync, useDebounced } from '@/lib/hooks';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ErrorNote } from '@/components/ui/states';
import { formatNumber } from '@/lib/utils';
import { toast } from '@/store/ui';

export function Data() {
  const [params, setParams] = useSearchParams();
  const scraperId = params.get('scraper') ?? '';
  const { data: scrapers } = useAsync<Scraper[]>(() => api.scrapers(), []);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<string | undefined>();
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const debouncedSearch = useDebounced(search, 300);

  const [syncOpen, setSyncOpen] = useState(false);
  const [table, setTable] = useState('scraped_items');
  const [writeMode, setWriteMode] = useState('append');
  const [dedupe, setDedupe] = useState('');
  const [ddl, setDdl] = useState<string | null>(null);

  const records = useAsync(
    () => api.records({ scraperId: scraperId || undefined, search: debouncedSearch, sort, dir, page, pageSize }),
    [scraperId, debouncedSearch, sort, dir, page, pageSize],
  );

  useEffect(() => setPage(1), [scraperId, debouncedSearch, pageSize]);

  useEffect(() => {
    if (!scraperId) {
      setDdl(null);
      return;
    }
    api
      .ddl(scraperId, table)
      .then((result) => setDdl(result.ddl))
      .catch(() => setDdl(null));
  }, [scraperId, table]);

  const selected = useMemo(() => scrapers?.find((entry) => entry.id === scraperId), [scrapers, scraperId]);

  const sync = async () => {
    if (!scraperId) {
      toast('Pick a scraper first', 'error');
      return;
    }
    try {
      const result = await api.sync({
        scraperId,
        table,
        mode: writeMode,
        dedupeOn: dedupe
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      });
      toast(result.inserted + ' inserted, ' + result.updated + ' updated, ' + result.skipped + ' skipped in ' + result.table, 'ok');
      setSyncOpen(false);
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  const clear = async () => {
    if (!scraperId) return;
    const result = await api.deleteRecords({ scraperId });
    toast('Removed ' + formatNumber(result.deleted) + ' records', 'ok');
    records.reload();
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={scraperId}
          onChange={(event) => setParams(event.target.value ? { scraper: event.target.value } : {})}
          className="h-9 w-auto min-w-[240px]"
        >
          <option value="">All scrapers</option>
          {scrapers?.map((scraper) => (
            <option key={scraper.id} value={scraper.id}>
              {scraper.name} ({formatNumber(scraper.records)})
            </option>
          ))}
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => setSyncOpen(true)} disabled={!scraperId}>
            <Database className="h-3.5 w-3.5" />
            Save to table
          </Button>
          <Button variant="danger" onClick={clear} disabled={!scraperId || !records.data?.total}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear records
          </Button>
        </div>
      </div>

      {records.error ? <ErrorNote message={records.error} retry={records.reload} /> : null}

      <DataTable
        rows={records.data?.rows ?? []}
        columns={records.data?.columns ?? []}
        total={records.data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        loading={records.loading && !records.data}
        search={search}
        sort={sort}
        dir={dir}
        onSearch={setSearch}
        onSort={(column) => {
          if (sort === column) {
            setDir(dir === 'asc' ? 'desc' : 'asc');
          } else {
            setSort(column);
            setDir('asc');
          }
        }}
        onPage={setPage}
        onPageSize={setPageSize}
        exportHref={(format, columns) => api.exportUrl({ scraperId: scraperId || undefined, format, columns })}
        emptyTitle={scraperId ? (selected?.name ?? 'This scraper') + ' has no records' : 'Nothing scraped yet'}
        emptyBody="Run a scraper and every extracted item lands here, searchable and exportable."
      />

      <Modal
        open={syncOpen}
        onOpenChange={setSyncOpen}
        title="Save records to a table"
        description="The destination table is created from the scraped shape. Existing tables gain any new columns."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSyncOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={sync}>
              Write rows
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Table">
              <Input value={table} onChange={(event) => setTable(event.target.value)} className="font-mono text-[12.5px]" />
            </Field>
            <Field label="Write mode">
              <Select value={writeMode} onChange={(event) => setWriteMode(event.target.value)}>
                <option value="append">append</option>
                <option value="upsert">upsert</option>
                <option value="replace">replace</option>
              </Select>
            </Field>
            <Field label="Dedupe on" hint="comma separated">
              <Input value={dedupe} onChange={(event) => setDedupe(event.target.value)} placeholder="name, url" />
            </Field>
          </div>

          <div>
            <p className="label mb-1.5">Generated schema</p>
            <pre className="code max-h-52 overflow-auto rounded border border-line bg-sunken p-3 text-muted">
              {ddl ?? 'Run the scraper first: the schema is inferred from stored records.'}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}
