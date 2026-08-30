import { useState } from 'react';
import { HardDrive, Table2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Empty, ErrorNote, Loading } from '@/components/ui/states';
import { formatNumber, truncate } from '@/lib/utils';
import { toast } from '@/store/ui';

export function Store() {
  const { data, error, loading, reload } = useAsync(() => api.datastore(), []);
  const [preview, setPreview] = useState<{ table: string; rows: Record<string, unknown>[] } | null>(null);

  const open = async (table: string) => {
    try {
      const response = await fetch('/api/datastore/tables/' + table + '?limit=50');
      const payload = (await response.json()) as { table: string; rows: Record<string, unknown>[] };
      setPreview(payload);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const drop = async (table: string) => {
    try {
      await api.dropTable(table);
      toast('Dropped ' + table, 'ok');
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  if (loading && !data) return <Loading label="Reading the data store" />;
  if (error) return <ErrorNote message={error} retry={reload} />;
  if (!data) return null;

  const columns = preview?.rows.length ? Object.keys(preview.rows[0]).slice(0, 8) : [];

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <section className="panel flex flex-wrap items-center gap-x-10 gap-y-3 px-5 py-4">
        <div>
          <p className="label">Driver</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-[14px]">
            <HardDrive className="h-4 w-4 text-accent" />
            {data.driver}
          </p>
        </div>
        <div>
          <p className="label">Location</p>
          <p className="mt-1 font-mono text-[12.5px] text-muted">
            {data.driver === 'sqlite' ? data.config.sqlitePath : truncate(data.config.postgresUrl, 48)}
          </p>
        </div>
        <div>
          <p className="label">Tables</p>
          <p className="tabular mt-1 font-mono text-[14px]">{data.tables.length}</p>
        </div>
        <div className="min-w-[220px] flex-1">
          <p className="label">Transform plugins</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {data.plugins.map((plugin) => (
              <span
                key={plugin.name}
                title={plugin.description}
                className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-2xs text-muted"
              >
                {plugin.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[13.5px] font-semibold">Destination tables</h2>
          <span className="text-xs text-faint">created automatically from scraped shapes</span>
        </header>

        {data.tables.length === 0 ? (
          <Empty
            icon={<Table2 className="h-5 w-5" />}
            title="No tables yet"
            body="Add an output block with a table name to a scraper config, or push existing records across from the Records page."
          />
        ) : (
          <ul className="divide-y divide-line">
            {data.tables.map((table) => (
              <li key={table.name} className="group flex items-center gap-4 px-5 py-3">
                <button onClick={() => open(table.name)} className="min-w-0 flex-1 text-left">
                  <span className="font-mono text-[13px]">{table.name}</span>
                </button>
                <span className="tabular font-mono text-[12.5px] text-muted">{formatNumber(table.rows)} rows</span>
                <Button size="sm" variant="ghost" onClick={() => open(table.name)}>
                  Browse
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => drop(table.name)}
                  title="Drop table"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={Boolean(preview)}
        onOpenChange={(next) => !next && setPreview(null)}
        title={preview?.table ?? ''}
        description="Newest 50 rows straight from the destination table."
        size="lg"
      >
        {preview?.rows.length ? (
          <div className="max-h-[52vh] overflow-auto rounded border border-line">
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
                {preview.rows.map((row, index) => (
                  <tr key={index} className="border-b border-line last:border-b-0">
                    {columns.map((column) => (
                      <td key={column} className="max-w-[240px] truncate px-3 py-2 text-[12.5px]">
                        {truncate(row[column], 70)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-[13px] text-muted">This table is empty.</p>
        )}
      </Modal>
    </div>
  );
}
