/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Masculine, premium menswear palette — charcoal/ink + warm bronze.
        // (Names kept as maroon/gold/cream so the whole app re-skins centrally.)
        maroon: {        // → INK / charcoal (primary)
          DEFAULT: '#1c1f26',
          dark: '#0e1014',
          light: '#2c313b'
        },
        gold: {          // → BRONZE (accent)
          DEFAULT: '#b6894d',
          dark: '#8f6a39',
          light: '#d0a567'
        },
        cream: {         // → COOL LIGHT (surfaces / on-dark text)
          DEFAULT: '#f4f5f7',
          dark: '#e3e5ea'
        },
        steel: '#3a4150'
      },
      fontFamily: {
        // Strong condensed display for headings, clean sans for body, elegant
        // Playfair for editorial accents (per the ui-ux-pro-max luxury recommendation).
        serif: ['Oswald', 'Arial Narrow', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        editorial: ['"Playfair Display"', 'Georgia', 'serif']
      },
      boxShadow: {
        card: '0 4px 20px -6px rgba(14, 16, 20, 0.22)'
      }
    }
  },
  plugins: []
}
