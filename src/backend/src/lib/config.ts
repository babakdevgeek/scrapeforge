export const env = {
  port: Number(process.env.PORT ?? 3000),
  headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  defaultTimeout: Number(process.env.DEFAULT_TIMEOUT_MS ?? 30_000),
  dataStore: {
    driver: (process.env.DATA_STORE_DRIVER ?? 'sqlite') as 'sqlite' | 'postgres',
    sqlitePath: process.env.DATA_STORE_SQLITE_PATH ?? './data/scraped.db',
    postgresUrl: process.env.DATA_STORE_POSTGRES_URL ?? '',
  },
  userAgent:
    process.env.DEFAULT_USER_AGENT ??
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 ScrapeForge/0.1',
};
