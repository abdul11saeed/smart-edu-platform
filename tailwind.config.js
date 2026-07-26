import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ============================================
      // DESIGN TOKENS - Spacing System
      // ============================================
      spacing: {
        '0.5': '0.125rem',    // 2px
        '1.5': '0.375rem',    // 6px
        '2.5': '0.625rem',    // 10px
        '3.5': '0.875rem',    // 14px
        '4.5': '1.125rem',    // 18px
        '5.5': '1.375rem',    // 22px
        '6.5': '1.625rem',    // 26px
        '7.5': '1.875rem',    // 30px
        '18': '4.5rem',       // 72px
        '22': '5.5rem',       // 88px
      },
      
      // ============================================
      // DESIGN TOKENS - Border Radius
      // ============================================
      borderRadius: {
        'none': '0',
        'sm': '0.25rem',      // 4px - subtle
        'DEFAULT': '0.5rem',  // 8px - standard
        'md': '0.5rem',       // 8px - standard
        'lg': '0.75rem',      // 12px - elevated
        'xl': '1rem',         // 16px - prominent
        '2xl': '1.5rem',      // 24px - card-like
        '3xl': '2rem',        // 32px - section
        'full': '9999px',
      },
      
      // ============================================
      // DESIGN TOKENS - Shadow System
      // ============================================
      boxShadow: {
        // Base shadows
        'none': 'none',
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        // Card shadows
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        // Elevated shadows
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        // Topbar/Sidebar specific
        'topbar': '0 1px 3px 0 rgb(0 0 0 / 0.05)',
        'sidebar': '4px 0 6px -1px rgb(0 0 0 / 0.05)',
        // Interactive states
        'button': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'button-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      
      // ============================================
      // DESIGN TOKENS - Typography Hierarchy
      // ============================================
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],        // 12px - labels, captions
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],    // 14px - secondary text
        'base': ['1rem', { lineHeight: '1.5rem' }],        // 16px - body text
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],     // 18px - emphasized body
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],     // 20px - card titles
        '2xl': ['1.5rem', { lineHeight: '2rem' }],         // 24px - section titles
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],     // 30px - page titles
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],      // 36px - hero titles
      },
      
      // Font weights
      fontWeight: {
        'thin': '100',
        'extralight': '200',
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700',
        'extrabold': '800',
      },
      
      // Letter spacing
      letterSpacing: {
        'tighter': '-0.05em',
        'tight': '-0.025em',
        'normal': '0',
        'wide': '0.025em',
        'wider': '0.05em',
        'widest': '0.1em',
      },
      
      // ============================================
      // DESIGN TOKENS - Colors (Extended)
      // ============================================
      colors: {
        // Warm Brown palette - elegant, calm & academic
        // 'brown' is an alias for 'primary' for semantic consistency
        brown: {
          50: '#F9F0E6',      // Light cream - soft backgrounds
          100: '#F2E0CE',     // Very light beige
          200: '#E8C9A8',     // Light tan
          300: '#D4A77A',     // Warm tan
          400: '#B8865E',     // Medium brown
          500: '#A0714A',     // Rich brown
          600: '#8B5E34',     // Deep brown
          700: '#7B4D2A',     // Dark brown - main accent
          800: '#5C3A1E',     // Very dark brown
          900: '#3B2314',     // Deepest brown
          950: '#291A0A',     // Near black brown
        },
        primary: {
          50: '#F9F0E6',      // Light cream - soft backgrounds
          100: '#F2E0CE',     // Very light beige
          200: '#E8C9A8',     // Light tan
          300: '#D4A77A',     // Warm tan
          400: '#B8865E',     // Medium brown
          500: '#A0714A',     // Rich brown
          600: '#8B5E34',     // Deep brown
          700: '#7B4D2A',     // Dark brown - main accent
          800: '#5C3A1E',     // Very dark brown
          900: '#3B2314',     // Deepest brown
          950: '#291A0A',     // Near black brown
        },
        // Warm Gold/Amber secondary - complementary
        secondary: {
          50: '#FFFBEB',      // Light cream
          100: '#FEF3C7',     // Light amber
          200: '#FDE68A',     // Soft amber
          300: '#FCD34D',     // Medium amber
          400: '#FBBF24',     // Bright amber
          500: '#F59E0B',     // Amber main
          600: '#D97706',     // Deep amber
          700: '#B45309',     // Dark amber
          800: '#92400E',     // Rich dark amber
          900: '#78350F',     // Deepest amber
          950: '#451A03',     // Near black amber
        },
        // Warm accent for highlights - terracotta
        accent: {
          50: '#FEF2E8',      // very light terracotta
          100: '#FDE4D0',
          200: '#FBC9A1',
          300: '#F9AE72',
          400: '#F79343',
          500: '#F57814',     // Terracotta main
          600: '#D46612',     // Deep terracotta
          700: '#B35410',     // Dark terracotta
          800: '#92420E',     // Rich dark terracotta
          900: '#71300C',     // Deepest terracotta
          950: '#501E0A',     // very deep terracotta
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Warm neutral palette - earthy beige/brown
        neutral: {
          50: '#FFFBEB',     // Cream
          100: '#F5E6D3',    // Light beige
          200: '#E8D5C4',    // Warm tan
          300: '#D4C4B0',    // Soft brown-gray
          400: '#B8A090',    // Medium warm gray
          500: '#9C8B7A',    // Warm gray
          600: '#7A6B5A',    // Deep warm gray
          700: '#5C4F42',    // Brown-gray
          800: '#3D342A',    // Dark brown-gray
          900: '#2A231C',    // Deep brown-gray
          950: '#1A1512',    // Near black brown
        },
        // Warm Sage - success/accent green
        sage: {
          50: '#f0f9f4',
          100: '#d9f0e3',
          200: '#b7e0c9',
          300: '#8bc4a8',
          400: '#6B8F71',
          500: '#5a7d62',
          600: '#4a6a52',
          700: '#3a5642',
          800: '#2a4232',
          900: '#1a2e22',
          950: '#0f1a14',
        },
        // Warm file type colors - cohesive brown/amber palette
        file: {
          pdf: '#8B5E34',    // Warm brown
          doc: '#7B4D2A',    // Dark brown
          ppt: '#D97706',    // Amber/Gold
          other: '#A0714A',  // Medium brown
          excel: '#6B8F71',  // Warm sage
          image: '#B8865E',  // Warm brown-light
          video: '#D97706',  // Amber
          audio: '#8B5E34',  // Warm brown
        },
      },
      
      // ============================================
      // DESIGN TOKENS - Transitions & Animations
      // ============================================
      transitionDuration: {
        '0': '0ms',
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },
      
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'smooth-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'elastic': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spring': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      
      // ============================================
      // DESIGN TOKENS - Z-Index Scale
      // ============================================
      zIndex: {
        '0': '0',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'toast': '1080',
      },
      
      // ============================================
      // DESIGN TOKENS - Breakpoints (Extended)
      // ============================================
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      
      // ============================================
      // DESIGN TOKENS - Max Widths
      // ============================================
      maxWidth: {
        'xs': '20rem',
        'sm': '24rem',
        'md': '28rem',
        'lg': '32rem',
        'xl': '36rem',
        '2xl': '42rem',
        '3xl': '48rem',
        '4xl': '56rem',
        '5xl': '64rem',
        '6xl': '72rem',
        '7xl': '80rem',
        'prose': '65ch',
      },
      
      // ============================================
      // DESIGN TOKENS - Background Opacity
      // ============================================
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [typography],
}
