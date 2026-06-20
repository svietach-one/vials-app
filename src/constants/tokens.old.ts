export const colors = {
  bg: '#F5F2EB',
  bgSecondary: '#EDE8DE',
  border: '#D4CFC4',
  textPrimary: '#2F4F4F',
  textSecondary: '#4A6363',
  textMuted: '#7A9494',
  accent: '#008080',
  accentDark: '#006666',
  accentLight: '#B2D8D8',
  warning: '#B8860B',
  warningBg: '#FFF8E7',
  danger: '#A04040',
  dangerBg: '#FFF0F0',
  success: '#2E7D5A',
  successBg: '#E8F5EE',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  displaySerif: {
    fontFamily: 'DMSerifDisplay-Regular',
    fontSize: 28,
    lineHeight: 34,
  },
  h1: { fontFamily: 'DMSans-Medium', fontSize: 22, lineHeight: 28 },
  h2: { fontFamily: 'DMSans-Medium', fontSize: 18, lineHeight: 24 },
  body: { fontFamily: 'DMSans-Regular', fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: 'DMSans-Regular', fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: 'DMSans-Regular', fontSize: 11, lineHeight: 16 },
  label: { fontFamily: 'DMSans-Medium', fontSize: 11, letterSpacing: 0.08 },
} as const;
