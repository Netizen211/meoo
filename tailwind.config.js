module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pdd: {
          primary: 'var(--pdd-primary)',
          'primary-light': 'var(--pdd-primary-light)',
          'primary-dark': 'var(--pdd-primary-dark)',
          bg: 'var(--pdd-bg)',
          card: 'var(--pdd-card)',
          sidebar: 'var(--pdd-sidebar)',
          text: 'var(--pdd-text)',
          'text-secondary': 'var(--pdd-text-secondary)',
          border: 'var(--pdd-border)',
          success: 'var(--pdd-success)',
          warning: 'var(--pdd-warning)',
          danger: 'var(--pdd-danger)',
          info: 'var(--pdd-info)',
          gray: {
            50: 'var(--pdd-gray-50)',
            100: 'var(--pdd-gray-100)',
            200: 'var(--pdd-gray-200)',
            300: 'var(--pdd-gray-300)',
            400: 'var(--pdd-gray-400)',
            500: 'var(--pdd-gray-500)',
            600: 'var(--pdd-gray-600)',
            700: 'var(--pdd-gray-700)',
            800: 'var(--pdd-gray-800)',
            900: 'var(--pdd-gray-900)',
          },
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'sans-serif'],
      },
    }
  },
  plugins: []
};
