/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        raised: 'var(--raised)',
        sunken: 'var(--sunken)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        'accent-soft': 'var(--accent-soft)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        pink: 'var(--pink)',
        yellow: 'var(--yellow)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        sm: '5px',
        DEFAULT: '7px',
        md: '9px',
        lg: '13px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      keyframes: {
        'fade-rise': {
          from: { opacity: '0', transform: 'translate3d(0, 6px, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        sweep: { '0%': { opacity: '0.35' }, '50%': { opacity: '1' }, '100%': { opacity: '0.35' } },
      },
      animation: {
        'fade-rise': 'fade-rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        pulse: 'sweep 1400ms cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
