import { create } from 'zustand';
import type { Mode } from '@/lib/api';

export interface CapturedField {
  name: string;
  selector: string;
  xpath?: string;
  type: 'text' | 'attribute' | 'html' | 'list' | 'number';
  attribute?: string;
  sample?: string;
}

interface BuilderState {
  step: 1 | 2 | 3;
  name: string;
  description: string;
  mode: Mode;
  url: string;
  headers: string;
  cookies: string;
  authType: 'none' | 'basic' | 'bearer' | 'header' | 'form_login';
  authValues: Record<string, string>;
  json: string;
  captured: CapturedField[];
  dirty: boolean;
  set: (patch: Partial<Omit<BuilderState, 'set' | 'reset' | 'addField' | 'removeField'>>) => void;
  addField: (field: CapturedField) => void;
  removeField: (name: string) => void;
  reset: (seed?: Partial<BuilderState>) => void;
}

export const emptyConfig = (mode: Mode, url = 'https://example.com') => {
  if (mode === 'api') {
    return {
      mode: 'api',
      request: { url, method: 'GET' },
      response: { items: '$.data', fields: { name: '$.title', price: { path: '$.price', type: 'number' } } },
      output: { store: true, table: 'items', mode: 'append' },
    };
  }
  if (mode === 'browser') {
    return {
      mode: 'browser',
      target: { url },
      actions: [{ type: 'wait_for', selector: 'body' }],
      item: { selector: '.item', fields: { name: '.title' } },
      output: { store: true, table: 'items', mode: 'append' },
    };
  }
  return {
    mode: 'html',
    target: { url },
    item: { selector: '.item', fields: { name: '.title', price: { selector: '.price', type: 'number' } } },
    output: { store: true, table: 'items', mode: 'append' },
  };
};

const initial = {
  step: 1 as const,
  name: '',
  description: '',
  mode: 'html' as Mode,
  url: '',
  headers: '{}',
  cookies: '',
  authType: 'none' as const,
  authValues: {} as Record<string, string>,
  json: JSON.stringify(emptyConfig('html'), null, 2),
  captured: [] as CapturedField[],
  dirty: false,
};

export const useBuilder = create<BuilderState>((set, get) => ({
  ...initial,
  set: (patch) => set({ ...patch, dirty: true }),
  addField: (field) => set({ captured: [...get().captured.filter((f) => f.name !== field.name), field], dirty: true }),
  removeField: (name) => set({ captured: get().captured.filter((f) => f.name !== name), dirty: true }),
  reset: (seed) => set({ ...initial, ...seed, dirty: false }),
}));
