import type { Item } from '../scraper-engine/types.js';

export interface TransformPlugin {
  name: string;
  description: string;
  transform(item: Item): Item;
}

const registry = new Map<string, TransformPlugin>();

export function register(plugin: TransformPlugin) {
  registry.set(plugin.name, plugin);
  return plugin;
}

export function list() {
  return [...registry.values()].map(({ name, description }) => ({ name, description }));
}

export function applyPlugins(item: Item, names: string[] = []): Item {
  return names.reduce((acc, name) => {
    const plugin = registry.get(name);
    return plugin ? plugin.transform(acc) : acc;
  }, item);
}

/* ---------------------------- built-in transforms ---------------------------- */

register({
  name: 'trim-strings',
  description: 'Collapse whitespace on every string value.',
  transform: (item) =>
    Object.fromEntries(
      Object.entries(item).map(([k, v]) => [k, typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v]),
    ),
});

register({
  name: 'price-to-number',
  description: 'Convert currency-looking strings into numbers.',
  transform: (item) =>
    Object.fromEntries(
      Object.entries(item).map(([k, v]) => {
        if (typeof v !== 'string' || !/[€$£]|\d[.,]\d/.test(v)) return [k, v];
        const parsed = Number.parseFloat(v.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
        return [k, Number.isFinite(parsed) ? parsed : v];
      }),
    ),
});

register({
  name: 'drop-empty',
  description: 'Remove keys whose value is null, undefined or an empty string.',
  transform: (item) =>
    Object.fromEntries(Object.entries(item).filter(([, v]) => v !== null && v !== undefined && v !== '')),
});
