# ScrapeForge

A self-hosted visual scraping platform that runs entirely on localhost. Create, configure, run and
manage web scrapers without writing scraper code: the scraping logic lives in a JSON configuration
language, and the UI gives you an editor with schema completion, a point-and-click selector picker,
live run telemetry and a records browser.

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`
- Nothing is sent anywhere. Requests originate from your Node process, results land in your local database.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind, shadcn-style primitives on Radix, Monaco, React Router, Zustand |
| Backend | Node 20+, Fastify 5, TypeScript, Prisma, SQLite |
| Engines | Playwright (browser), Cheerio (HTML), Axios (API), JSONPath (JSON extraction) |
| Storage | SQLite by default, PostgreSQL optional, tables generated from the scraped shape |

## Quick start

```bash
git clone https://github.com/babakdevgeek/scrapeforge.git
cd scrapeforge
cp .env.example .env

npm install          # installs both workspaces, generates the Prisma client
npm run db:push      # creates the SQLite app database
npx playwright install chromium   # only needed for browser mode
npm run db:seed -w @scrapeforge/backend   # optional: four runnable example scrapers

npm run dev          # api on :3000, web on :5173
```

`npm run setup` does install, db:push and the Playwright download in one go.

## What is in the box

**Dashboard** with stored records, successful and failed runs, average duration, a 14-day activity
chart and recent run activity.

**Scrapers** list with mode, last execution, status, record count, and per-row actions: run, edit,
duplicate, export config, view records, delete. Import accepts a single config, an array, or an
exported file.

**Builder** in three steps plus two extras:

1. Target: URL, headers, cookies, authentication (basic, bearer, custom header, form login).
2. Mode: html, api or browser, each with a starter template.
3. Configuration: Monaco with JSON-schema completion, hover docs, inline validation, and a
   searchable reference panel beside the editor.

Plus a **visual selector builder** (load a page, click an element, get a CSS selector and XPath with
attribute options and a live match count) and **version history** with one-click restore.

**Runner** streams over server-sent events: live logs with level filters, current page, extracted
items as they arrive, error count, progress and a stop button.

**Records** browser with search, sort, pagination, column selection and export to JSON, CSV or Excel.

**Data store** page listing generated tables with row counts, a browse dialog, and table drop.

## Configuration language

Three modes share the same field extraction, pagination, deep-follow and output vocabulary.

### HTML mode

```json
{
  "mode": "html",
  "target": { "url": "https://books.toscrape.com/catalogue/page-1.html" },
  "item": {
    "selector": "article.product_pod",
    "fields": {
      "name": "h3 a",
      "price": { "selector": ".price_color", "type": "number" },
      "cover": { "selector": "img", "type": "attribute", "attribute": "src" }
    }
  },
  "pagination": { "type": "url", "url_template": "https://books.toscrape.com/catalogue/page-{page}.html", "max_pages": 5 },
  "output": { "table": "books", "mode": "upsert", "dedupe_on": ["name"] }
}
```

### API mode

```json
{
  "mode": "api",
  "request": { "url": "https://api.site.com/products", "method": "GET" },
  "response": {
    "items": "$.data",
    "fields": { "name": "$.title", "price": { "path": "$.price", "type": "number" } }
  }
}
```

### Browser mode

```json
{
  "mode": "browser",
  "target": { "url": "https://quotes.toscrape.com/scroll" },
  "actions": [
    { "type": "click", "selector": ".accept", "optional": true },
    { "type": "scroll", "times": 5 }
  ],
  "item": { "selector": ".quote", "fields": { "text": ".text", "author": ".author" } },
  "pagination": { "type": "infinite_scroll", "scroll_times": 5 }
}
```

### Field types

`text` (default), `attribute`, `html`, `regex` (with `group`), `list` (optional `separator`),
`table`, `number`, `boolean`, `constant`, and nested objects through `fields`. A bare string is a
selector; `"img@src"` is attribute shorthand.

### Pagination

`next_button` (selector), `url` (`url_template` with `{page}` or `{offset}`), `infinite_scroll`
(browser), `api` (parameter increment or `cursor_path`). `max_pages` is always respected;
`stop_condition` can be `no_items`, `no_next`, `duplicate_page` or `max_pages`.

### Deep scraping

```json
{
  "follow": {
    "enabled": true,
    "url_field": "detail_url",
    "concurrency": 3,
    "fields": { "description": ".description", "specs": { "selector": "table", "type": "table" } }
  }
}
```

Nest another `follow` inside for list to detail to reviews.

### Output and database

```json
{
  "output": { "store": true, "table": "products", "driver": "sqlite", "mode": "upsert", "dedupe_on": ["name"] }
}
```

Column types are inferred from the scraped values, so
`{ "name": "Phone", "price": 500, "category": "Mobile" }` produces:

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  price INTEGER,
  category TEXT,
  _scraped_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

New keys on later runs are added as columns. `mode` picks append, upsert (against `dedupe_on`) or
replace. Set `DATA_STORE_DRIVER=postgres` plus `DATA_STORE_POSTGRES_URL` and install `pg` to write
to PostgreSQL instead.

## Project structure

```
src/
  backend/
    prisma/schema.prisma        app database: scrapers, versions, runs, logs, records
    src/
      server.ts                 Fastify entry
      routes/                   scrapers, runs (SSE), records, stats, selector, datastore, examples
      services/                 run orchestration, exporters, selector preview
      schemas/                  zod configuration schema and validator
      scraper-engine/
        engines/html-engine.ts
        engines/api-engine.ts
        engines/browser-engine.ts
        extract.ts              text, attribute, html, regex, list, table, nested
        pagination.ts
        follow.ts               deep scraping
      database/                 schema inference, sqlite and postgres sinks
      plugins/                  row transforms
      examples/                 bundled example configs
  frontend/
    src/
      pages/                    Dashboard, Scrapers, Builder, Runs, RunView, Data, Store, Settings
      components/builder/       Monaco editor, schema docs, selector picker
      components/ui/            button, input, badge, menu, modal, states, toaster
      lib/                      api client, JSON schema, docs content, hooks
      store/                    zustand ui and builder state
examples/                       standalone JSON configs
```

## Themes

One token set, two themes. Light is a violet-tinted neutral surface. Dark is Dracula
(`#282a36`, `#44475a`, `#f8f8f2`, `#6272a4`, `#bd93f9`, `#50fa7b`, `#ff79c6`, `#ffb86c`, `#f1fa8c`)
and covers the dashboard, tables, forms, charts, logs and the Monaco editor. Toggle with `Cmd/Ctrl J`.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl K` | Command palette |
| `Cmd/Ctrl J` | Toggle theme |
| `Cmd/Ctrl B` | Collapse sidebar |
| `N` | New scraper |
| `Shift Alt F` | Format the configuration |

## API

```
GET    /api/health
GET    /api/stats
GET    /api/scrapers
POST   /api/scrapers
GET    /api/scrapers/:id
PATCH  /api/scrapers/:id
DELETE /api/scrapers/:id
POST   /api/scrapers/:id/duplicate
POST   /api/scrapers/:id/versions/:version/restore
POST   /api/scrapers/import
POST   /api/validate
POST   /api/scrapers/:id/run
GET    /api/runs
GET    /api/runs/:id
GET    /api/runs/:id/stream        server-sent events
POST   /api/runs/:id/cancel
GET    /api/records
GET    /api/records/export?format=json|csv|xlsx
DELETE /api/records
GET    /api/selector/preview?url=  sanitised page with the picker injected
POST   /api/selector/test
GET    /api/datastore
GET    /api/datastore/ddl?scraperId=
POST   /api/datastore/sync
GET    /api/examples
```

## Notes

- The selector preview strips scripts, so JavaScript-rendered pages may look bare. Use browser mode
  for those, and pick selectors from the real page structure.
- Browser mode needs `npx playwright install chromium` once.
- Be a good citizen: set `delay_ms`, keep `max_pages` sane, respect the terms of the sites you scrape.

MIT licensed.
