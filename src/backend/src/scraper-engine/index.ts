import type { ScraperConfig } from '../schemas/scraper-config.js';
import { runApiEngine } from './engines/api-engine.js';
import { runBrowserEngine } from './engines/browser-engine.js';
import { runHtmlEngine } from './engines/html-engine.js';
import type { EngineResult, RunContext } from './types.js';

export const engines = {
  html: runHtmlEngine,
  api: runApiEngine,
  browser: runBrowserEngine,
} as const;

export async function execute(config: ScraperConfig, ctx: RunContext): Promise<EngineResult> {
  switch (config.mode) {
    case 'html':
      return runHtmlEngine(config, ctx);
    case 'api':
      return runApiEngine(config, ctx);
    case 'browser':
      return runBrowserEngine(config, ctx);
    default: {
      const mode = (config as { mode?: string }).mode;
      throw new Error(`Unknown scraper mode: ${mode}`);
    }
  }
}

export * from './types.js';
