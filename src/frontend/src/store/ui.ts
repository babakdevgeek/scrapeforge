import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface Toast {
  id: number;
  tone: 'ok' | 'error' | 'info';
  message: string;
}

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  paletteOpen: boolean;
  docsOpen: boolean;
  toasts: Toast[];
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setPalette: (open: boolean) => void;
  setDocsOpen: (open: boolean) => void;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      sidebarCollapsed: false,
      paletteOpen: false,
      docsOpen: true,
      toasts: [],
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
      setDocsOpen: (docsOpen) => set({ docsOpen }),
      toast: (message, tone = 'info') => {
        const id = Date.now() + Math.random();
        set({ toasts: [...get().toasts, { id, tone, message }] });
        setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 4200);
      },
      dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    {
      name: 'scrapeforge-ui',
      partialize: (state) => ({ theme: state.theme, sidebarCollapsed: state.sidebarCollapsed, docsOpen: state.docsOpen }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme);
      },
    },
  ),
);

export const toast = (message: string, tone?: Toast['tone']) => useUi.getState().toast(message, tone);
