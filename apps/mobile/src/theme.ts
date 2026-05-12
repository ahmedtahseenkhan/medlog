// ─── MedLog AI — Modern Health Design System ─────────────────────────────────
// Direction: Teal/emerald primary · White cards · Warm professional
// Inspired by premium health apps — polished, trustworthy, clean

export const colors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  primary:       '#0D9488',   // Teal-600 — distinctive, clinical, not generic blue
  primaryDark:   '#0F766E',   // Teal-700 — pressed/dark
  primaryLight:  '#F0FDFA',   // Teal-50  — backgrounds, active states
  primaryMid:    '#CCFBF1',   // Teal-100 — badges, chips

  // ── Clinical Status ─────────────────────────────────────────────────────────
  critical:      '#DC2626',   // Red-600  — CRITICAL patients only
  criticalBg:    '#FEF2F2',
  criticalBorder:'#FECACA',
  danger:        '#DC2626',

  warning:       '#D97706',   // Amber-600 — abnormal values, upcoming alerts
  warningLight:  '#FEF3C7',
  warningBorder: '#FDE68A',

  success:       '#059669',   // Emerald-600 — admitted, stable, completed
  successLight:  '#ECFDF5',
  successBorder: '#A7F3D0',

  // ── Surfaces ─────────────────────────────────────────────────────────────
  bg:            '#F0FAFA',   // Barely-teal screen background
  surface:       '#FFFFFF',   // Card surface
  surfacePressed:'#F8FFFE',   // Card pressed state

  // ── Text ──────────────────────────────────────────────────────────────────
  text:          '#0F172A',   // Slate-900 primary
  textMid:       '#475569',   // Slate-600 secondary
  textSoft:      '#94A3B8',   // Slate-400 placeholder / meta

  // ── Borders ───────────────────────────────────────────────────────────────
  line:          '#E2E8F0',   // Slate-200
  lineLight:     '#F1F5F9',   // Slate-100

  white:         '#FFFFFF',
  black:         '#0F172A',

  // ── Legacy aliases ────────────────────────────────────────────────────────
  danger0:        '#DC2626',
  dangerLight:   '#FEF2F2',
  warningLight0: '#FEF3C7',
  successLight0: '#ECFDF5',
  gray50:        '#F8FAFC',
  gray100:       '#F1F5F9',
  gray200:       '#E2E8F0',
  gray300:       '#CBD5E1',
  gray400:       '#94A3B8',
  gray500:       '#64748B',
  gray700:       '#334155',
  gray900:       '#0F172A',
  screenBg:      '#F0FAFA',
  cardBg:        '#FFFFFF',
  ink:           '#0F172A',
  inkMid:        '#1E293B',
  inkSoft:       '#334155',
  textTertiary:  '#94A3B8',
  criticalBg:    '#FEF2F2',
  criticalBorder:'#FECACA',
  abnormal:      '#D97706',
  abnormalBg:    '#FEF3C7',
  abnormalBorder:'#FDE68A',
  stable:        '#059669',
  stableBg:      '#ECFDF5',
  stableBorder:  '#A7F3D0',
  line0:         '#E2E8F0',
  lineLight0:    '#F1F5F9',
  surfaceHover:  '#F8FFFE',
}

// ─── Typography ───────────────────────────────────────────────────────────────
export const typography = {
  h1:        { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
  h2:        { fontSize: 22, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.3 },
  h3:        { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  h4:        { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body:      { fontSize: 15, fontWeight: '400' as const, color: colors.textMid, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, color: colors.textSoft, lineHeight: 18 },
  label:     { fontSize: 11, fontWeight: '700' as const, color: colors.textSoft, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  mono:      { fontSize: 14, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as any, color: colors.text },
  monoLarge: { fontSize: 26, fontWeight: '800' as const, fontVariant: ['tabular-nums'] as any, letterSpacing: -1, color: colors.text },
  monoSmall: { fontSize: 12, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as any, color: colors.textMid },
}

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 }

// ─── Radius ───────────────────────────────────────────────────────────────────
export const radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, full: 999 }

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const shadow = {
  sm: {
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
}
