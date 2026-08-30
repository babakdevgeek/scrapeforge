export interface DocEntry {
  key: string;
  summary: string;
  detail?: string;
  values?: { name: string; note: string }[];
  snippet?: string;
}

export interface DocSection {
  id: string;
  title: string;
  blurb: string;
  entries: DocEntry[];
}

/** Reference content for the panel beside the editor. Mirrors the JSON schema. */
export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'mode',
    title: 'mode',
    blurb: 'Picks the engine. Everything else in the config follows from this.',
    entries: [
      {
        key: 'html',
        summary: 'Static HTML through axios + cheerio. Fastest, no browser.',
        snippet: '{\n  "mode": "html",\n  "target": { "url": "https://example.com" },\n  "item": {\n    "selector": ".product",\n    "fields": { "name": ".title", "price": { "selector": ".price", "type": "number" } }\n  }\n}',
      },
      {
        key: 'api',
        summary: 'JSON endpoints through axios, mapped with JSONPath.',
        snippet: '{\n  "mode": "api",\n  "request": { "url": "https://api.site.com/products", "method": "GET" },\n  "response": {\n    "items": "$.data",\n    "fields": { "name": "$.title", "price": "$.price" }\n  }\n}',
      },
      {
        key: 'browser',
        summary: 'Playwright drives a real Chromium: clicks, waits, scrolling, logins.',
        snippet: '{\n  "mode": "browser",\n  "target": { "url": "https://example.com" },\n  "actions": [\n    { "type": "click", "selector": ".accept", "optional": true },\n    { "type": "scroll", "times": 5 }\n  ],\n  "item": { "selector": ".card", "fields": { "name": "h3" } }\n}',
      },
    ],
  },
  {
    id: 'fields',
    title: 'fields',
    blurb: 'Every field is either a selector string or an object with an extraction type.',
    entries: [
      { key: 'text', summary: 'Default. Element text, whitespace collapsed.' },
      {
        key: 'attribute',
        summary: 'Read an attribute. Relative href/src values are resolved against the page URL.',
        snippet: '{\n  "image": { "selector": "img", "type": "attribute", "attribute": "src" }\n}',
      },
      { key: 'html', summary: 'Inner HTML of the first match.' },
      {
        key: 'regex',
        summary: 'Run a pattern over the element text and keep one capture group.',
        snippet: '{\n  "stock": {\n    "selector": ".availability",\n    "type": "regex",\n    "regex": "\\\\((\\\\d+) available\\\\)",\n    "group": 1\n  }\n}',
      },
      {
        key: 'list',
        summary: 'All matches as an array. Add "separator" to join them, "attribute" to read attributes.',
        snippet: '{\n  "tags": { "selector": ".tag", "type": "list" }\n}',
      },
      {
        key: 'table',
        summary: 'Parse a table into row objects. Headers are detected, or set "columns".',
        snippet: '{\n  "specs": { "selector": "table.specs", "type": "table" }\n}',
      },
      { key: 'number', summary: 'Strip currency and separators, return a real number.' },
      { key: 'boolean', summary: 'True when the selector matches at least one element.' },
      { key: 'nested', summary: 'Add "fields" to any field to build a nested object.' },
    ],
  },
  {
    id: 'pagination',
    title: 'pagination',
    blurb: 'Controls multiple pages. Always set max_pages.',
    entries: [
      {
        key: 'type',
        summary: 'Defines the pagination strategy.',
        values: [
          { name: 'next_button', note: 'Follow a next link or button via selector.' },
          { name: 'url', note: 'Build page URLs from url_template using {page} or {offset}.' },
          { name: 'infinite_scroll', note: 'Browser mode only: scroll until nothing new loads.' },
          { name: 'api', note: 'Increment a query parameter or follow cursor_path.' },
        ],
      },
      { key: 'selector', summary: 'CSS selector for the next button.' },
      { key: 'url_template', summary: 'Pattern such as https://site.com/page-{page}.html' },
      { key: 'max_pages', summary: 'Hard ceiling. The run stops here no matter what.' },
      {
        key: 'stop_condition',
        summary: 'Early exit rule.',
        values: [
          { name: 'no_items', note: 'Stop when a page yields zero items (default).' },
          { name: 'no_next', note: 'Stop when the next control disappears.' },
          { name: 'duplicate_page', note: 'Stop when a page repeats the previous one.' },
          { name: 'max_pages', note: 'Only the page ceiling stops the run.' },
        ],
      },
      {
        key: 'example',
        summary: 'URL pagination with a delay.',
        snippet: '{\n  "pagination": {\n    "type": "url",\n    "url_template": "https://site.com/page-{page}",\n    "start": 1,\n    "max_pages": 20,\n    "delay_ms": 300\n  }\n}',
      },
    ],
  },
  {
    id: 'follow',
    title: 'follow',
    blurb: 'Deep scraping. List page then detail page, optionally one level deeper.',
    entries: [
      { key: 'url_field', summary: 'Which field on the list item holds the detail URL.' },
      { key: 'concurrency', summary: 'How many detail pages are fetched in parallel.' },
      { key: 'merge', summary: 'Merge detail fields into the item, or nest them under "detail".' },
      {
        key: 'example',
        summary: 'Product list to product detail.',
        snippet: '{\n  "follow": {\n    "enabled": true,\n    "url_field": "detail_url",\n    "fields": { "description": ".description" }\n  }\n}',
      },
    ],
  },
  {
    id: 'actions',
    title: 'actions',
    blurb: 'Browser mode only. Runs in order before extraction.',
    entries: [
      { key: 'click', summary: 'Click a selector. Add "optional": true for cookie banners.' },
      { key: 'type', summary: 'Fill an input with "value".' },
      { key: 'wait_for', summary: 'Wait until a selector appears.' },
      { key: 'wait', summary: 'Fixed pause in delay_ms.' },
      { key: 'scroll', summary: 'Scroll down "times" screens with delay_ms between rounds.' },
      { key: 'press', summary: 'Press a key such as Enter or PageDown.' },
      { key: 'evaluate', summary: 'Run "script" inside the page.' },
    ],
  },
  {
    id: 'output',
    title: 'output',
    blurb: 'Storage. The destination table is created from the scraped shape.',
    entries: [
      { key: 'table', summary: 'Destination table name.' },
      { key: 'driver', summary: 'sqlite (default) or postgres.' },
      {
        key: 'mode',
        summary: 'Write strategy.',
        values: [
          { name: 'append', note: 'Insert everything.' },
          { name: 'upsert', note: 'Update existing rows matched by dedupe_on.' },
          { name: 'replace', note: 'Drop the table and rebuild it.' },
        ],
      },
      {
        key: 'dedupe_on',
        summary: 'Columns forming the unique key. Also used to skip duplicates inside a run.',
        snippet: '{\n  "output": {\n    "table": "products",\n    "mode": "upsert",\n    "dedupe_on": ["name"]\n  }\n}',
      },
    ],
  },
];
