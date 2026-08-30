/**
 * Runnable example configurations. These target public scraping sandboxes so a
 * fresh install has something real to run on first launch.
 */
export interface Example {
  slug: string;
  name: string;
  description: string;
  mode: 'html' | 'api' | 'browser';
  config: Record<string, unknown>;
}

export const examples: Example[] = [
  {
    slug: 'books-catalogue',
    name: 'Books catalogue (HTML + pagination)',
    description: 'Static HTML with URL pagination, attribute extraction and a number field.',
    mode: 'html',
    config: {
      mode: 'html',
      target: { url: 'https://books.toscrape.com/catalogue/page-1.html' },
      item: {
        selector: 'article.product_pod',
        fields: {
          title: { selector: 'h3 a', type: 'attribute', attribute: 'title' },
          price: { selector: '.price_color', type: 'number' },
          availability: '.instock.availability',
          rating: { selector: 'p.star-rating', type: 'attribute', attribute: 'class' },
          cover: { selector: 'img.thumbnail', type: 'attribute', attribute: 'src' },
          detail_url: { selector: 'h3 a', type: 'attribute', attribute: 'href' },
        },
      },
      pagination: {
        type: 'url',
        url_template: 'https://books.toscrape.com/catalogue/page-{page}.html',
        start: 1,
        max_pages: 5,
        delay_ms: 250,
        stop_condition: 'no_items',
      },
      output: { store: true, table: 'books', mode: 'upsert', dedupe_on: ['title'] },
    },
  },
  {
    slug: 'books-deep-scrape',
    name: 'Book details (deep scrape)',
    description: 'List page then detail page: description, UPC and the product information table.',
    mode: 'html',
    config: {
      mode: 'html',
      target: { url: 'https://books.toscrape.com/catalogue/page-1.html' },
      item: {
        selector: 'article.product_pod',
        limit: 8,
        fields: {
          title: { selector: 'h3 a', type: 'attribute', attribute: 'title' },
          detail_url: { selector: 'h3 a', type: 'attribute', attribute: 'href' },
        },
      },
      follow: {
        enabled: true,
        url_field: 'detail_url',
        concurrency: 3,
        fields: {
          description: '#product_description ~ p',
          upc: { selector: 'table.table-striped tr:nth-of-type(1) td' },
          specs: { selector: 'table.table-striped', type: 'table' },
          images: { selector: '#product_gallery img', type: 'list', attribute: 'src' },
        },
      },
      output: { store: true, table: 'book_details', mode: 'upsert', dedupe_on: ['upc'] },
    },
  },
  {
    slug: 'dummyjson-products',
    name: 'Product API (JSONPath + cursor)',
    description: 'REST endpoint with offset pagination and JSONPath field mapping.',
    mode: 'api',
    config: {
      mode: 'api',
      request: {
        url: 'https://dummyjson.com/products',
        method: 'GET',
        query: { limit: 30 },
      },
      response: {
        items: '$.products.*',
        total_path: '$.total',
        fields: {
          name: '$.title',
          price: { path: '$.price', type: 'number' },
          category: '$.category',
          rating: { path: '$.rating', type: 'number' },
          tags: { path: '$.tags', type: 'list' },
          thumbnail: '$.thumbnail',
        },
      },
      pagination: {
        type: 'api',
        url_template: 'https://dummyjson.com/products?limit=30&skip={offset}',
        step: 30,
        max_pages: 4,
        stop_condition: 'no_items',
      },
      output: { store: true, table: 'products', mode: 'upsert', dedupe_on: ['name'] },
    },
  },
  {
    slug: 'quotes-infinite-scroll',
    name: 'Quotes (browser + infinite scroll)',
    description: 'Playwright driven: dismiss overlays, scroll to load, then extract.',
    mode: 'browser',
    config: {
      mode: 'browser',
      target: { url: 'https://quotes.toscrape.com/scroll' },
      viewport: { width: 1440, height: 900 },
      block_resources: ['image', 'font', 'media'],
      actions: [
        { type: 'wait_for', selector: '.quote', timeout_ms: 15000 },
        { type: 'scroll', times: 3, delay_ms: 700 },
      ],
      item: {
        selector: '.quote',
        fields: {
          text: '.text',
          author: '.author',
          tags: { selector: '.tag', type: 'list' },
        },
      },
      pagination: { type: 'infinite_scroll', scroll_times: 5, delay_ms: 900, max_pages: 5 },
      output: { store: true, table: 'quotes', mode: 'append', dedupe_on: ['text'] },
    },
  },
];

export const exampleBySlug = (slug: string) => examples.find((example) => example.slug === slug);
