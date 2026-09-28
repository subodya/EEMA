// Tailwind config for the admin panel (admin.html). Build: `npm run build:css:admin`.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './eema-fashion-website/admin.html',
    './eema-fashion-website/js/admin.js'
  ],
  theme: {
    extend: {
      colors: {
        'linen-canvas': '#FBF9F5',
        'linen-elevated': '#F5F1EA',
        'linen-stone': '#EAE4DC',
        'noir-text': '#1A1A1A',
        'charcoal-body': '#333333',
        'secondary': '#5f5e5e',
        'primary': '#960052',
        'primary-container': '#b8236b',
        'berry-deep': '#8C154E',
        'berry-soft': '#F8E9F0',
        'whatsapp-forest': '#1E5E3A',
        'error': '#ba1a1a',
        'error-container': '#ffdad6'
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
