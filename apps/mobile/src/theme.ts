export const colors = {
  primary: '#0EA5E9',       // sky-500 — professional medical blue
  primaryDark: '#0284C7',
  primaryLight: '#E0F2FE',
  success: '#10B981',       // emerald
  successLight: '#D1FAE5',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',
  white: '#FFFFFF',
  cardBg: '#FFFFFF',
  screenBg: '#F1F5F9',  // slate-100
}

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.gray900, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.gray900 },
  h3: { fontSize: 18, fontWeight: '600' as const, color: colors.gray900 },
  h4: { fontSize: 16, fontWeight: '600' as const, color: colors.gray900 },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.gray700 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, color: colors.gray500 },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.gray500, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  mono: { fontSize: 14, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as any },
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 }

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, full: 999 }

export const shadow = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
}
