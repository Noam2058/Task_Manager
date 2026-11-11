import animate from 'tailwindcss-animate';
/** @type {import('tailwindcss').Config} */
const v = (name) => `var(--${name})`;
// צבע מ-CSS variable שתומך גם ב-bg-primary/40 וכו'
const c = (name) => ({ opacityValue }) =>
  opacityValue === undefined || opacityValue === '1' ? `var(--${name})` : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`;
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), 'surface-2': c('surface-2'), 'surface-3': c('surface-3'),
        border: c('border'), 'border-strong': c('border-strong'),
        text: c('text'), muted: c('text-muted'), subtle: c('text-subtle'),
        primary: { DEFAULT: c('primary'), hover: c('primary-hover'), soft: c('primary-soft'), fg: c('primary-fg') },
        success: c('success'), warning: c('warning'), danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
      },
      fontFamily: { sans: ['Heebo', 'system-ui', 'sans-serif'] },
      fontSize: {
        xs: ['12px', '16px'], sm: ['13px', '20px'], base: ['14px', '22px'], md: ['16px', '24px'],
        lg: ['20px', '28px'], xl: ['26px', '34px'], '2xl': ['32px', '40px'],
      },
      borderRadius: { sm: v('radius-sm'), DEFAULT: v('radius'), lg: v('radius-lg'), xl: v('radius-xl') },
      boxShadow: {
        xs: v('shadow-xs'), sm: v('shadow-sm'), md: v('shadow-md'), lg: v('shadow-lg'),
        focus: '0 0 0 3px var(--focus)', card: v('shadow-card'),
      },
      maxWidth: { page: '1400px', dash: '1200px' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(.2,.8,.2,1)' },
      keyframes: {
        'pop': { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)' } },
        'rise': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'drawer-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
      },
      animation: {
        pop: 'pop 280ms cubic-bezier(.2,.8,.2,1)',
        rise: 'rise 180ms cubic-bezier(.2,.8,.2,1) both',
        'sheet-up': 'sheet-up 260ms cubic-bezier(.2,.8,.2,1)',
        'drawer-in': 'drawer-in 240ms cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [animate],
};
