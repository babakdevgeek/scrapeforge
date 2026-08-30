import { useEffect, useState } from 'react';
import { Crosshair, ExternalLink, MousePointerClick, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Empty } from '@/components/ui/states';
import { toast } from '@/store/ui';
import type { CapturedField } from '@/store/builder';
import { cn } from '@/lib/utils';

interface Picked {
  selector: string;
  xpath: string;
  tag: string;
  text: string;
  attributes: Record<string, string>;
  matches: number;
}

/** Inspector-style picker: load a page, click an element, keep the selector. */
export function SelectorBuilder({
  url,
  onCapture,
  captured,
  onRemove,
}: {
  url: string;
  onCapture: (field: CapturedField) => void;
  captured: CapturedField[];
  onRemove: (name: string) => void;
}) {
  const [loadedUrl, setLoadedUrl] = useState('');
  const [draft, setDraft] = useState(url);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [type, setType] = useState<CapturedField['type']>('text');
  const [attribute, setAttribute] = useState('');
  const [testing, setTesting] = useState(false);
  const [matches, setMatches] = useState<number | null>(null);

  useEffect(() => setDraft(url), [url]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Picked & { source?: string };
      if (data?.source !== 'scrapeforge-picker') return;
      setPicked(data);
      setMatches(data.matches);
      setFieldName((current) => current || suggestName(data));
      setType(data.tag === 'img' ? 'attribute' : 'text');
      setAttribute(data.tag === 'img' ? 'src' : data.tag === 'a' ? 'href' : '');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const load = () => {
    if (!draft.trim()) return toast('Enter a URL to preview', 'error');
    setLoadedUrl(draft.trim());
    setPicked(null);
  };

  const test = async () => {
    if (!picked || !loadedUrl) return;
    setTesting(true);
    try {
      const result = await api.testSelector(loadedUrl, picked.selector);
      setMatches(result.matches);
      toast(`${result.matches} element${result.matches === 1 ? '' : 's'} matched`, result.matches ? 'ok' : 'error');
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    if (!picked) return;
    if (!fieldName.trim()) return toast('Name the field first', 'error');
    onCapture({
      name: fieldName.trim().replace(/\s+/g, '_').toLowerCase(),
      selector: picked.selector,
      xpath: picked.xpath,
      type,
      attribute: type === 'attribute' ? attribute || 'href' : undefined,
      sample: picked.text,
    });
    toast(`Saved ${fieldName}`, 'ok');
    setFieldName('');
    setPicked(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
      <div className="flex min-h-[520px] flex-col overflow-hidden rounded-lg border border-line bg-raised">
        <div className="flex items-center gap-2 border-b border-line p-2.5">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && load()}
            placeholder="https://books.toscrape.com/"
            className="h-8 font-mono text-[12.5px]"
          />
          <Button size="sm" variant="secondary" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
            Load
          </Button>
          {loadedUrl ? (
            <a
              href={loadedUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1.5 text-faint transition-colors hover:bg-sunken hover:text-ink"
              title="Open the real page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>

        {loadedUrl ? (
          <iframe
            key={loadedUrl}
            title="Page preview"
            src={api.previewUrl(loadedUrl)}
            sandbox="allow-same-origin allow-scripts"
            className="h-full min-h-[460px] w-full flex-1 bg-white"
          />
        ) : (
          <Empty
            icon={<Crosshair className="h-5 w-5" />}
            title="Load a page to start picking"
            body="Scripts are stripped and the page is served through the local API, so clicking is safe. Hover highlights elements, clicking captures a selector."
          />
        )}
      </div>

      <div className="space-y-4">
        <div className="panel p-4">
          <p className="label mb-3">Picked element</p>
          {picked ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <code className="code block break-all rounded border border-line bg-sunken px-2.5 py-2 text-accent">
                  {picked.selector}
                </code>
                <code className="code block break-all text-[11.5px] text-faint">{picked.xpath}</code>
              </div>

              {picked.text ? <p className="text-[13px] leading-relaxed text-muted">{picked.text}</p> : null}

              <div className="flex items-center gap-2 text-xs">
                <span className={cn('font-medium', matches && matches > 0 ? 'text-ok' : 'text-warn')}>
                  {matches ?? picked.matches} match{(matches ?? picked.matches) === 1 ? '' : 'es'}
                </span>
                <button onClick={test} className="text-accent underline-offset-4 hover:underline" disabled={testing}>
                  {testing ? 'testing\u2026' : 'test on server'}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Field name">
                  <Input value={fieldName} onChange={(event) => setFieldName(event.target.value)} placeholder="product_price" />
                </Field>
                <Field label="Type">
                  <Select value={type} onChange={(event) => setType(event.target.value as CapturedField['type'])}>
                    <option value="text">text</option>
                    <option value="attribute">attribute</option>
                    <option value="html">html</option>
                    <option value="list">list</option>
                    <option value="number">number</option>
                  </Select>
                </Field>
              </div>

              {type === 'attribute' ? (
                <Field label="Attribute" hint={Object.keys(picked.attributes).join(', ') || undefined}>
                  <Select value={attribute} onChange={(event) => setAttribute(event.target.value)}>
                    {['href', 'src', 'title', 'alt', 'value', ...Object.keys(picked.attributes)]
                      .filter((name, index, all) => all.indexOf(name) === index)
                      .map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                  </Select>
                </Field>
              ) : null}

              <Button variant="primary" size="sm" onClick={save} className="w-full">
                Save field
              </Button>
            </div>
          ) : (
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
              <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
              Click any element in the preview. ScrapeForge generates a CSS selector and an XPath, then you name it.
            </p>
          )}
        </div>

        <div className="panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="label">Captured fields</p>
            <span className="tabular text-xs text-faint">{captured.length}</span>
          </div>
          {captured.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-muted">Nothing captured yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {captured.map((field) => (
                <li key={field.name} className="group flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-[12.5px] text-ink">{field.name}</p>
                    <p className="truncate font-mono text-[11.5px] text-faint">
                      {field.selector}
                      {field.attribute ? `@${field.attribute}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemove(field.name)}
                    className="text-2xs text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function suggestName(picked: Picked) {
  const fromClass = picked.selector.split('.').pop()?.split(/[>:\s]/)[0];
  if (fromClass && /^[a-z_-]{3,}$/i.test(fromClass)) return fromClass.replace(/-/g, '_').toLowerCase();
  return picked.tag === 'img' ? 'image' : picked.tag === 'a' ? 'link' : 'field';
}
