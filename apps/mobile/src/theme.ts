// ─── MedLog AI — Clinical Precision Design System ────────────────────────────
// Direction: authoritative, data-dense, clinical — NOT consumer-app friendly
// Color is reserved for clinical meaning only (red=critical, amber=abnormal, green=stable)

export const colors = {
  // ── Brand / Structure ──────────────────────────────────────────────────────
  ink:          '#0F172A',   // Slate-900 — headers, primary text, top bars
  inkMid:       '#1E293B',   // Slate-800 — secondary headers
  inkSoft:      '#334155',   // Slate-700 — body text

  // ── Interactive ────────────────────────────────────────────────────────────
  primary:      '#2563EB',   // Blue-600 — buttons, links, focus rings
  primaryDark:  '#1D4ED8',   // Blue-700 — pressed state
  primaryLight: '#EFF6FF',   // Blue-50  — active backgrounds

  // ── Clinical Status (strict — do not use for decoration) ──────────────────
  critical:     '#DC2626',   // Red-600  — critical lab values, critical patient
  criticalBg:   '#FEF2F2',   // Red-50
  criticalBorder:'#FECACA',  // Red-200
  abnormal:     '#D97706',   // Amber-600 — abnormal values, warnings
  abnormalBg:   '#FFFBEB',   // Amber-50
  abnormalBorder:'#FDE68A',  // Amber-200
  stable:       '#16A34A',   // Green-600 — admitted, stable, normal
  stableBg:     '#F0FDF4',   // Green-50
  stableBorder: '#BBF7D0',   // Green-200

  // ── Neutral Surface Scale ──────────────────────────────────────────────────
  white:        '#FFFFFF',
  bg:           '#F8FAFC',   // Slate-50  — screen background
  surface:      '#FFFFFF',   // Card / panel background
  surfaceHover: '#F1F5F9',   // Slate-100 — pressed row bg

  // ── Borders ────────────────────────────────────────────────────────────────
  line:         '#E2E8F0',   // Slate-200 — dividers, input borders
  lineLight:    '#F1F5F9',   // Slate-100 — subtle section dividers

  // ── Text Scale ─────────────────────────────────────────────────────────────
  text:         '#0F172A',   // Slate-900 — primary text
  textMid:      '#475569',   // Slate-600 — secondary text
  textSoft:     '#94A3B8',   // Slate-400 — placeholder, timestamps

  // ── Legacy aliases (keeps existing screens working) ───────────────────────
  danger:       '#DC2626',
  dangerLight:  '#FEF2F2',
  warning:      '#D97706',
  warningLight: '#FFFBEB',
  success:      '#16A34A',
  successLight: '#F0FDF4',
  gray50:       '#F8FAFC',
  gray100:      '#F1F5F9',
  gray200:      '#E2E8F0',
  gray300:      '#CBD5E1',
  gray400:      '#94A3B8',
  gray500:      '#64748B',
  gray700:      '#334155',
  gray900:      '#0F172A',
  screenBg:     '#F8FAFC',
  cardBg:       '#FFFFFF',
  primaryDarkLegacy: '#1D4ED8',
}

// ─── Typography ───────────────────────────────────────────────────────────────
// Rule: clinical numbers always use mono. Labels always UPPERCASE + tracked.
export const typography = {
  // Headings
  h1:        { fontSize: 26, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
  h2:        { fontSize: 20, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.3 },
  h3:        { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  h4:        { fontSize: 15, fontWeight: '600' as const, color: colors.text },

  // Body
  body:      { fontSize: 15, fontWeight: '400' as const, color: colors.textMid, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, color: colors.textSoft, lineHeight: 18 },

  // Labels — used for field labels, section headers, column heads
  label:     { fontSize: 11, fontWeight: '700' as const, color: colors.textSoft, letterSpacing: 0.8, textTransform: 'uppercase' as const },

  // Mono — ALL clinical numbers: MR#, BP, lab values, times
  mono:      { fontSize: 14, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as any, color: colors.text },
  monoLarge: { fontSize: 26, fontWeight: '800' as const, fontVariant: ['tabular-nums'] as any, letterSpacing: -1, color: colors.text },
  monoSmall: { fontSize: 12, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as any, color: colors.textMid },
}

// ─── Spacing — 4pt base grid ──────────────────────────────────────────────────
export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
}

// ─── Radius ───────────────────────────────────────────────────────────────────
// Deliberately small — clinical software is precise, not bubbly
export const radius = {
  xs:   3,
  sm:   5,
  md:   8,
  lg:   12,
  xl:   16,
  full: 999,
}

// ─── Elevation — hairlines preferred over heavy shadows ──────────────────────
export const shadow = {
  // Use only for floating elements (FAB, modals, bottom sheets)
  // Data rows use hairline borders instead
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 7,
  },
}
