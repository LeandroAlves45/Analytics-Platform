/**
 * Configuração do Tailwind CSS para o Analytics Platform.
 * Dois namespaces de cor coexistem sem colisão:
 * - shadcn/ui: background, foreground, primary, card, border… (HSL via CSS vars)
 * - dashboard: app, surface-*, purple, blue, copy, label… (tokens da marca)
 */

import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],

  theme: {
    extend: {
      colors: {
        // --- shadcn/ui bridge (valores em index.css :root) ---
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // --- Dashboard: superfícies ---
        app: '#0f0f13',
        'surface-card': '#141419',
        'surface-card-hover': '#18181f',
        sidebar: '#0c0c10',

        // --- Dashboard: marca ---
        purple: {
          DEFAULT: '#9b7fe8',
          dark: '#7055cc',
        },
        blue: {
          DEFAULT: '#5bbcf7',
          dark: '#3a9fd8',
        },
        orange: {
          DEFAULT: '#f97a4a',
          dark: '#d45d30',
        },

        // --- Dashboard: semânticas ---
        success: '#3dd68c',
        danger: '#ff6464',

        // --- Dashboard: texto (não colide com shadcn primary/secondary/muted) ---
        copy: '#e8e6f0',
        label: '#8b8899',
        meta: '#5a576a',
        faint: '#4a4760',

        // --- Dashboard: borders ---
        'border-default': 'rgba(255, 255, 255, 0.07)',
        'border-subtle': 'rgba(255, 255, 255, 0.04)',
      },

      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },

      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4' }],
        xs: ['11px', { lineHeight: '1.4' }],
        sm: ['12px', { lineHeight: '1.5' }],
        base: ['13px', { lineHeight: '1.6' }],
        md: ['14px', { lineHeight: '1.6' }],
        lg: ['16px', { lineHeight: '1.4' }],
        kpi: ['22px', { lineHeight: '1.1' }],
      },

      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        badge: '4px',
        DEFAULT: '8px',
        card: '10px',
      },

      animation: {
        pulse: 'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.8)' },
        },
      },
    },
  },

  plugins: [tailwindcssAnimate],
};

export default config;
