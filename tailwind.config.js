/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
          overlay: 'var(--color-surface-overlay)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
        },
      },
      fontFamily: {
        sans: ['neue-haas-grotesk-text', 'system-ui', 'sans-serif'],
        serif: ['freight-text-pro', 'serif'],
        mono: ['IBM Plex Mono', 'serif']
      },
    },
  },
  plugins: [],
}
