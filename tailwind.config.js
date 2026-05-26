/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#060E20' },
        surface: {
          DEFAULT: '#101415',
          dim: '#101415',
          bright: '#363a3b',
          container: '#1d2022',
        },
        primary: {
          DEFAULT: '#d0bcff',
          fixed: '#e9ddff',
          glow: '#8B5CF6',
        },
        secondary: '#bcc7de',
        tertiary: '#ffb869',
        onSurface: '#e0e3e5',
        onSurfaceVariant: '#cbc3d7',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      spacing: {
        base: '8px',
        gutter: '24px',
        'margin-mobile': '16px',
        'margin-desktop': '48px',
      },
      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
      },
      boxShadow: {
        'glow-primary': '0 0 20px 2px rgba(139, 92, 246, 0.3)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(to right, #8B5CF6, #A78BFA)',
      }
    },
  },
  plugins: [],
}