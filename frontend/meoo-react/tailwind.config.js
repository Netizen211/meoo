/**
 * Tailwind CSS 配置
 * 参考设计系统: shadcn/ui + Horizon UI + Cruip/Mosaic
 *
 * Layer 1 (CSS 变量) 定义在 src/styles/theme.css
 * 这里将 CSS 变量映射为 Tailwind 原子类
 */
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
      // 阴影变量映射 — 使用方式: shadow-pdd-sm / shadow-pdd-lg
      boxShadow: {
        'pdd-xs': 'var(--pdd-shadow-xs)',
        'pdd-sm': 'var(--pdd-shadow-sm)',
        'pdd-md': 'var(--pdd-shadow-md)',
        'pdd-lg': 'var(--pdd-shadow-lg)',
        'pdd-xl': 'var(--pdd-shadow-xl)',
        'pdd-card-hover': 'var(--pdd-shadow-card-hover)',
      },
      // 圆角变量映射 — 使用方式: rounded-pdd-lg
      borderRadius: {
        'pdd-xs': 'var(--pdd-radius-xs)',
        'pdd-sm': 'var(--pdd-radius-sm)',
        'pdd-md': 'var(--pdd-radius-md)',
        'pdd-lg': 'var(--pdd-radius-lg)',
        'pdd-xl': 'var(--pdd-radius-xl)',
        'pdd-2xl': 'var(--pdd-radius-2xl)',
      },
      // 动画持续
      transitionDuration: {
        'pdd-fast': 'var(--pdd-duration-fast)',
        'pdd-normal': 'var(--pdd-duration-normal)',
        'pdd-slow': 'var(--pdd-duration-slow)',
      },
      // 动画缓动
      transitionTimingFunction: {
        'pdd-out': 'var(--pdd-ease-out)',
        'pdd-in-out': 'var(--pdd-ease-in-out)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'sans-serif'],
      },
      // shadcn/ui 风格的折叠面板动画
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    }
  },
  plugins: [
    // 动画插件 — 提供 animate-in / animate-out / slide-in-from-* / slide-out-to-* 等
    require('tailwindcss-animate'),
  ],
};
