import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#B30B0B',
          'red-bright': '#E62314',
          orange: '#F26A0F',
          dark: '#121A22',
        },
        navy: {
          900: '#121A22',
          text: '#E1E5EA',
          muted: '#9AA3AE',
        },
        sia: {
          card: '#FFFFFF',
          border: '#E4E4E0',
          muted: '#5F5F5A',
        },
        status: {
          draft: { bg: '#ECECE8', text: '#3D3D3A' },
          waiting: { bg: '#FFF0D1', text: '#7A4B00' },
          ready: { bg: '#E3EEFF', text: '#1B4FA0' },
          numbered: { bg: '#DDF3E4', text: '#1D6B3A' },
          rejected: { bg: '#FBE0E4', text: '#9A1028' },
        },
      },
      fontFamily: {
        sans: ["'SIG Text'", 'var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        sig: ["'SIG Text'", 'var(--font-inter)', 'Inter', 'sans-serif'],
        display: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'page-gradient': 'linear-gradient(135deg, #FFF3EA 0%, #F4F4F7 55%, #EEF0F5 100%)',
        'btn-primary': 'linear-gradient(90deg, #B30B0B, #E62314 55%, #F26A0F)',
        'btn-primary-hover': 'linear-gradient(90deg, #A50D25, #D41F10 55%, #DF5E09)',
        'top-accent': 'linear-gradient(90deg, #B30B0B, #F26A0F)',
        'login-hero': 'linear-gradient(160deg, #121A22 0%, #1E1417 55%, #B30B0B 135%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(18,26,34,.04), 0 10px 28px rgba(18,26,34,.06)',
        btn: '0 6px 16px rgba(179,11,11,.25)',
      },
    },
  },
  plugins: [],
};

export default config;

