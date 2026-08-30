import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Braces, Crosshair, History, Play, Save, SlidersHorizontal, Target } from 'lucide-react';
import { api, type Mode, type ScraperVersion } from '@/lib/api';
import { emptyConfig, useBuilder } from '@/store/builder';
import { useUi, toast } from '@/store/ui';
import { useDebounced } from '@/lib/hooks';
import { JsonEditor } from '@/components/builder/JsonEditor';
import { SchemaDocs } from '@/components/builder/SchemaDocs';
import { SelectorBuilder } from '@/components/builder/SelectorBuilder';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { ModeTag } from '@/components/ui/badge';
import { Loading } from '@/components/ui/states';
import { cn, relativeTime, safeParse } from '@/lib/utils';

type Step = 'target' | 'mode' | 'config' | 'picker' | 'history';

const STEPS: { id: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'target', label: '1 · Target', icon: Target },
  { id: 'mode', label: '2 · Mode', icon: SlidersHorizontal },
  { id: 'config', label: '3 · Configuration', icon: Braces },
  { id: 'picker', label: 'Visual picker', icon: Crosshair },
  { id: 'history', label: 'Versions', icon: History },
];

const MODE_COPY: Record<Mode, { title: string; body: string }> = {
  html: {
    title: 'HTML',
    body: 'axios fetches the markup, cheerio reads it. No browser, so it is the fastest option. Use it whenever the data is already in the server response.',
  },
  api: {
    title: 'API',
    body: 'Hit the JSON endpoint the page itself calls. Fields map through JSONPath, pagination increments a parameter or follows a cursor.',
  },
  browser: {
    title: 'Browser',
    body: 'Playwright drives real Chromium: clicks, waits, logins, infinite scroll. Slowest path, but it sees whatever a user would see.',
  },
};

export function Builder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const builder = useBuilder();
  const { docsOpen, setDocsOpen } = useUi();
  const [step, setStep] = useState<Step>('target');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [versions, setVersions] = useState<ScraperVersion[]>([]);

  const debouncedJson = useDebounced(builder.json, 400);

  useEffect(() => {
    if (!id) {
      builder.reset();
      setStep('target');
      return;
    }
    setLoading(true);
    api
      .scraper(id)
      .then((scraper) => {
        const config = scraper.config as Record<string, any>;
        builder.reset({
          name: scraper.name,
          description: scraper.description ?? '',
          mode: scraper.mode,
          url: config?.target?.url ?? config?.url ?? config?.request?.url ?? '',
          headers: JSON.stringify(config?.target?.headers ?? {}, null, 2),
          json: JSON.stringify(config, null, 2),
        });
        setVersions(scraper.versions ?? []);
        setStep('config');
      })
      .catch((error) => toast((error as Error).message, 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const parsed = safeParse(debouncedJson);
    if (!parsed.ok) return;
    api
      .validate(parsed.value)
      .then((result) => setErrors(result.errors))
      .catch(() => setErrors([]));
  }, [debouncedJson]);

  const parsedConfig = useMemo(() => safeParse<Record<string, any>>(builder.json), [builder.json]);

  const mutate = (mutator: (config: Record<string, any>) => void) => {
    const parsed = safeParse<Record<string, any>>(builder.json);
    if (!parsed.ok) {
      toast('Fix the JSON first: ' + parsed.error, 'error');
      return;
    }
    const next = parsed.value;
    mutator(next);
    builder.set({ json: JSON.stringify(next, null, 2) });
  };

  const switchMode = (mode: Mode) => {
    builder.set({ mode, json: JSON.stringify(emptyConfig(mode, builder.url || 'https://example.com'), null, 2) });
  };

  const applyTarget = () =>
    mutate((config) => {
      const headers = safeParse<Record<string, string>>(builder.headers || '{}');
      if (config.mode === 'api') {
        config.request = { ...(config.request ?? {}), url: builder.url || config.request?.url };
        if (headers.ok && Object.keys(headers.value).length) config.request.headers = headers.value;
        config.target = config.target ?? {};
      } else {
        config.target = { ...(config.target ?? {}), url: builder.url };
        if (headers.ok && Object.keys(headers.value).length) config.target.headers = headers.value;
      }
      if (builder.cookies.trim()) config.target.cookies = builder.cookies.trim();
      if (builder.authType !== 'none') config.target.auth = { type: builder.authType, ...builder.authValues };
      toast('Target written into the configuration', 'ok');
    });

  const applyFields = () =>
    mutate((config) => {
      if (!builder.captured.length) {
        toast('Capture a few fields first', 'error');
        return;
      }
      const fields: Record<string, unknown> = {};
      for (const field of builder.captured) {
        fields[field.name] =
          field.type === 'text'
            ? field.selector
            : {
                selector: field.selector,
                type: field.type,
                ...(field.attribute ? { attribute: field.attribute } : {}),
              };
      }
      if (config.mode === 'api') {
        config.response = {
          ...(config.response ?? { items: '$' }),
          fields: { ...(config.response?.fields ?? {}), ...fields },
        };
      } else {
        config.item = {
          selector: config.item?.selector ?? '.item',
          fields: { ...(config.item?.fields ?? {}), ...fields },
          ...(config.item?.limit ? { limit: config.item.limit } : {}),
        };
      }
      toast(builder.captured.length + ' field(s) merged', 'ok');
    });

  const save = async (thenRun = false) => {
    const parsed = safeParse(builder.json);
    if (!parsed.ok) {
      toast('Invalid JSON: ' + parsed.error, 'error');
      return;
    }
    if (!builder.name.trim()) {
      toast('Give the scraper a name', 'error');
      return;
    }

    setSaving(true);
    try {
      const saved = id
        ? await api.updateScraper(id, { name: builder.name, description: builder.description, config: parsed.value })
        : await api.createScraper({ name: builder.name, description: builder.description, config: parsed.value });

      toast(id ? 'Configuration saved' : 'Scraper created', 'ok');

      if (thenRun) {
        const run = await api.run(saved.id);
        navigate('/runs/' + run.id);
        return;
      }
      if (!id) navigate('/scrapers/' + saved.id);
      else setVersions((await api.scraper(id)).versions ?? []);
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const restore = async (version: number) => {
    if (!id) return;
    try {
      const scraper = await api.restoreVersion(id, version);
      builder.set({ json: JSON.stringify(scraper.config, null, 2) });
      setVersions((await api.scraper(id)).versions ?? []);
      toast('Restored v' + version, 'ok');
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  if (loading) return <Loading label="Loading scraper" />;

  return (
    <div className="mx-auto max-w-[1320px] space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <input
            value={builder.name}
            onChange={(event) => builder.set({ name: event.target.value })}
            placeholder="Untitled scraper"
            className="w-full bg-transparent font-display text-[22px] font-semibold tracking-[-0.02em] placeholder:text-faint focus:outline-none"
          />
          <input
            value={builder.description}
            onChange={(event) => builder.set({ description: event.target.value })}
            placeholder="Add a short description"
            className="mt-0.5 w-full bg-transparent text-[13px] text-muted placeholder:text-faint focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <ModeTag mode={builder.mode} />
          <Button variant="secondary" onClick={() => save(false)} loading={saving}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
          <Button variant="primary" onClick={() => save(true)} loading={saving}>
            <Play className="h-3.5 w-3.5" />
            Save and run
          </Button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-line">
        {STEPS.filter((entry) => entry.id !== 'history' || id).map(({ id: stepId, label, icon: Icon }) => (
          <button
            key={stepId}
            onClick={() => setStep(stepId)}
            className={cn(
              'relative flex items-center gap-2 px-3 py-2.5 text-[13px] transition-colors',
              step === stepId ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {step === stepId ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" /> : null}
          </button>
        ))}
      </nav>

      {step === 'target' ? (
        <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="panel space-y-4 p-5">
            <Field label="Start URL" hint="The first page, or the endpoint in api mode.">
              <Input
                value={builder.url}
                onChange={(event) => builder.set({ url: event.target.value })}
                placeholder="https://books.toscrape.com/catalogue/page-1.html"
                className="font-mono text-[12.5px]"
              />
            </Field>

            <Field label="Headers" hint="JSON object. Useful for user-agent, accept-language, API keys.">
              <Textarea value={builder.headers} onChange={(event) => builder.set({ headers: event.target.value })} rows={4} />
            </Field>

            <Field label="Cookies" hint="Cookie header string, copied straight out of devtools.">
              <Input
                value={builder.cookies}
                onChange={(event) => builder.set({ cookies: event.target.value })}
                placeholder="session=abc123; locale=en"
                className="font-mono text-[12.5px]"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Authentication">
                <Select
                  value={builder.authType}
                  onChange={(event) => builder.set({ authType: event.target.value as typeof builder.authType })}
                >
                  <option value="none">none</option>
                  <option value="basic">basic</option>
                  <option value="bearer">bearer token</option>
                  <option value="header">custom header</option>
                  <option value="form_login">form login (browser)</option>
                </Select>
              </Field>

              {builder.authType === 'basic' ? (
                <>
                  <Field label="Username">
                    <Input
                      value={builder.authValues.username ?? ''}
                      onChange={(event) => builder.set({ authValues: { ...builder.authValues, username: event.target.value } })}
                    />
                  </Field>
                  <Field label="Password">
                    <Input
                      type="password"
                      value={builder.authValues.password ?? ''}
                      onChange={(event) => builder.set({ authValues: { ...builder.authValues, password: event.target.value } })}
                    />
                  </Field>
                </>
              ) : null}

              {builder.authType === 'bearer' || builder.authType === 'header' ? (
                <>
                  {builder.authType === 'header' ? (
                    <Field label="Header name">
                      <Input
                        value={builder.authValues.header ?? ''}
                        placeholder="x-api-key"
                        onChange={(event) => builder.set({ authValues: { ...builder.authValues, header: event.target.value } })}
                      />
                    </Field>
                  ) : null}
                  <Field label="Token">
                    <Input
                      value={builder.authValues.token ?? ''}
                      onChange={(event) => builder.set({ authValues: { ...builder.authValues, token: event.target.value } })}
                      className="font-mono text-[12.5px]"
                    />
                  </Field>
                </>
              ) : null}

              {builder.authType === 'form_login'
                ? [
                    ['login_url', 'Login URL'],
                    ['user_selector', 'Username selector'],
                    ['pass_selector', 'Password selector'],
                    ['submit_selector', 'Submit selector'],
                    ['username', 'Username'],
                    ['password', 'Password'],
                  ].map(([key, label]) => (
                    <Field key={key} label={label}>
                      <Input
                        value={builder.authValues[key] ?? ''}
                        onChange={(event) => builder.set({ authValues: { ...builder.authValues, [key]: event.target.value } })}
                        className="font-mono text-[12.5px]"
                      />
                    </Field>
                  ))
                : null}
            </div>

            <Button variant="secondary" size="sm" onClick={applyTarget}>
              Write into configuration
            </Button>
          </div>

          <div className="panel p-5">
            <h2 className="text-[13.5px] font-semibold">What ScrapeForge does with this</h2>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-muted">
              <li>Headers and cookies ride along on every request, detail pages included.</li>
              <li>Basic, bearer and header auth are applied by the HTTP client; form login runs in Chromium before extraction.</li>
              <li>Relative href and src values resolve against the page they came from, so detail URLs work unchanged.</li>
              <li>Nothing leaves your machine: requests go out from this Node process, results stay in your local database.</li>
            </ul>
          </div>
        </section>
      ) : null}

      {step === 'mode' ? (
        <section className="space-y-3">
          {(Object.keys(MODE_COPY) as Mode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => switchMode(mode)}
              className={cn(
                'flex w-full items-start gap-4 rounded-lg border px-5 py-4 text-left transition-colors',
                builder.mode === mode ? 'border-accent bg-[color:var(--accent)]/6' : 'border-line bg-raised hover:bg-sunken',
              )}
            >
              <ModeTag mode={mode} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{MODE_COPY[mode].title}</span>
                <span className="mt-1 block max-w-2xl text-[13px] leading-relaxed text-muted">{MODE_COPY[mode].body}</span>
              </span>
            </button>
          ))}
          <p className="text-xs text-faint">Switching mode replaces the configuration with a starter template for that engine.</p>
        </section>
      ) : null}

      {step === 'config' ? (
        <section className={cn('grid gap-4', docsOpen ? 'xl:grid-cols-[1.5fr_1fr]' : '')}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-muted">Completion, hover docs and validation come from the bundled JSON schema.</p>
              <button onClick={() => setDocsOpen(!docsOpen)} className="text-xs text-accent hover:underline">
                {docsOpen ? 'hide reference' : 'show reference'}
              </button>
            </div>
            <JsonEditor value={builder.json} onChange={(json) => builder.set({ json })} errors={errors} height={520} />
          </div>

          {docsOpen ? (
            <div className="max-h-[576px]">
              <SchemaDocs
                onInsert={(snippet) => {
                  const parsedSnippet = safeParse<Record<string, unknown>>(snippet);
                  if (!parsedSnippet.ok) return;
                  mutate((config) => Object.assign(config, parsedSnippet.value));
                }}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'picker' ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted">Click elements to capture selectors, then merge them into the config as fields.</p>
            <Button size="sm" variant="secondary" onClick={applyFields} disabled={!builder.captured.length}>
              Merge {builder.captured.length || ''} field{builder.captured.length === 1 ? '' : 's'} into config
            </Button>
          </div>
          <SelectorBuilder
            url={builder.url || (parsedConfig.ok ? parsedConfig.value?.target?.url ?? '' : '')}
            captured={builder.captured}
            onCapture={builder.addField}
            onRemove={builder.removeField}
          />
        </section>
      ) : null}

      {step === 'history' ? (
        <section className="panel overflow-hidden">
          {versions.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-muted">No versions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {versions.map((version) => (
                <li key={version.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="tabular font-mono text-[12.5px] text-accent">v{version.version}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{version.note ?? 'Config updated'}</span>
                  <span className="text-xs text-faint">{relativeTime(version.createdAt)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => builder.set({ json: JSON.stringify(JSON.parse(version.config), null, 2) })}
                  >
                    Preview
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => restore(version.version)}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
