/** All utilities are scoped under #bug-tracker-root and preflight is disabled,
 *  so nothing here can leak into (or be broken by) the WordPress admin styles. */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  important: '#bug-tracker-root',
  darkMode: ['selector', '.bt-dark'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--bt-border))',
        input: 'hsl(var(--bt-input))',
        ring: 'hsl(var(--bt-ring))',
        background: 'hsl(var(--bt-background))',
        foreground: 'hsl(var(--bt-foreground))',
        primary: { DEFAULT: 'hsl(var(--bt-primary))', foreground: 'hsl(var(--bt-primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--bt-secondary))', foreground: 'hsl(var(--bt-secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--bt-muted))', foreground: 'hsl(var(--bt-muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--bt-accent))', foreground: 'hsl(var(--bt-accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--bt-destructive))', foreground: 'hsl(var(--bt-destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--bt-card))', foreground: 'hsl(var(--bt-card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--bt-popover))', foreground: 'hsl(var(--bt-popover-foreground))' },
      },
      borderRadius: { lg: '0.625rem', md: '0.5rem', sm: '0.375rem' },
      keyframes: {
        'bt-fade': { from: { opacity: '0' }, to: { opacity: '1' } },
        'bt-pop': { from: { opacity: '0', transform: 'translate(-50%,-48%) scale(.97)' }, to: { opacity: '1', transform: 'translate(-50%,-50%) scale(1)' } },
        'bt-slide': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { 'bt-fade': 'bt-fade .15s ease-out', 'bt-pop': 'bt-pop .18s ease-out', 'bt-slide': 'bt-slide .2s ease-out' },
    },
  },
};
