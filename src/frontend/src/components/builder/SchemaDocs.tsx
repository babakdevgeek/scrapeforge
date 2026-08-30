import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { DOC_SECTIONS } from '@/lib/schema-docs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Reference panel that sits beside the editor. Snippets are click-to-copy. */
export function SchemaDocs({ onInsert }: { onInsert?: (snippet: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string[]>(['mode', 'pagination']);

  const sections = useMemo(() => {
    if (!query.trim()) return DOC_SECTIONS;
    const needle = query.toLowerCase();
    return DOC_SECTIONS.map((section) => ({
      ...section,
      entries: section.entries.filter(
        (entry) =>
          entry.key.toLowerCase().includes(needle) ||
          entry.summary.toLowerCase().includes(needle) ||
          entry.values?.some((value) => value.name.includes(needle)),
      ),
    })).filter((section) => section.entries.length > 0 || section.title.includes(needle));
  }, [query]);

  const toggle = (id: string) => setOpen((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-raised">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Search className="h-3.5 w-3.5 text-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the schema"
          className="h-7 w-full bg-transparent text-[13px] placeholder:text-faint focus:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted">No schema entry matches that.</p>
        ) : (
          sections.map((section) => {
            const expanded = query.trim() ? true : open.includes(section.id);
            return (
              <section key={section.id} className="border-b border-line last:border-b-0">
                <button
                  onClick={() => toggle(section.id)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-sunken"
                >
                  <ChevronRight
                    className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-200 ease-out', expanded && 'rotate-90')}
                  />
                  <span>
                    <span className="font-mono text-[13px] text-accent">{section.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{section.blurb}</span>
                  </span>
                </button>

                {expanded ? (
                  <dl className="space-y-3 px-3 pb-3.5 pl-8">
                    {section.entries.map((entry) => (
                      <div key={entry.key} className="animate-fade-in">
                        <dt className="font-mono text-[12.5px] text-ink">{entry.key}</dt>
                        <dd className="mt-0.5 text-xs leading-relaxed text-muted">{entry.summary}</dd>
                        {entry.values ? (
                          <dd className="mt-1.5 space-y-1">
                            {entry.values.map((value) => (
                              <div key={value.name} className="flex gap-2 text-xs">
                                <code className="shrink-0 font-mono text-pink">{value.name}</code>
                                <span className="text-faint">{value.note}</span>
                              </div>
                            ))}
                          </dd>
                        ) : null}
                        {entry.snippet ? (
                          <dd className="mt-2">
                            <pre className="code overflow-x-auto rounded border border-line bg-sunken p-2.5 text-[11.5px] leading-relaxed text-muted">
                              {entry.snippet}
                            </pre>
                            {onInsert ? (
                              <button
                                onClick={() => onInsert(entry.snippet!)}
                                className="mt-1.5 text-2xs font-medium text-accent transition-opacity hover:opacity-75"
                              >
                                use this
                              </button>
                            ) : null}
                          </dd>
                        ) : null}
                      </div>
                    ))}
                  </dl>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </aside>
  );
}
