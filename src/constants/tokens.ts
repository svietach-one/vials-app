/**
 * Vials — React Native design tokens
 * Translated from ds-tokens/colors.css, typography.css, spacing.css, effects.css.
 * Use these in StyleSheet.create() calls throughout the app.
 *
 * Font note: Hanken Grotesk / Newsreader / IBM Plex Mono are the target typefaces
 * from the new token set, but only DM Sans + DM Serif Display are installed in
 * package.json. Using installed fonts until the new ones are added.
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const palette = {
  white: '#FFFFFF',
  black: '#09090B',
  bone: '#FAF9F6',

  plum: '#4F1242',
  // Pressed state — one step lighter than plum, matching the zinc900→zinc800
  // "+15 per channel" pressed relationship used elsewhere in this palette.
  plumPressed: '#5E2151',
  plumTint: '#E5DBE3',
  plumLine: '#D8CBD5',

  zinc50: '#FAFAFA',
  zinc100: '#F4F4F5',
  zinc200: '#E4E4E7',
  zinc300: '#D4D4D8',
  zinc400: '#A1A1AA',
  zinc500: '#71717A',
  zinc600: '#52525B',
  zinc700: '#3F3F46',
  zinc800: '#27272A',
  zinc900: '#18181B',

  cabernet: '#800C2E',
  red: '#B40018',
  amber: '#A84C0E',
  marigold: '#EB970D',
  // Cool yellow — distinct from marigold's warm orange-yellow. Used for the
  // Routines screen's Morning card icon accent.
  citron: '#A69300',
  bottleGreen: '#0F4C3A',
  cobalt: '#1E3A8A',

  // Tints (15–18% saturation on white — approximated as flat values)
  cabernetTint: '#F8E9ED',
  redTint: '#F9E6E8',
  amberTint: '#FDF0E6',
  marigoldTint: '#FCEFDB',
  // Very light cream-yellow — Routines screen's Morning card background.
  citronTint: '#FBF7E3',
  bottleGreenTint: '#EBF4F1',
  cobaltTint: '#EBF0FA',

  // Hairlines (22% saturation)
  cabernetLine: '#DDB8C3',
  amberLine: '#E6C4AB',
  bottleGreenLine: '#B8D4CC',
  cobaltLine: '#B8C8E6',
} as const;

export const colors = {
  // Surfaces
  // bgBase: white — the sheet/modal/tab-bar surface. Standalone screens use
  // bgScreen (bone) instead; sheets stay white per design.
  bgBase: palette.white,
  bgScreen: palette.bone,
  bgSubtle: palette.zinc50,
  surfaceCard: palette.white,
  surfaceRaised: palette.white,
  surfaceSunken: palette.zinc100,

  // Borders
  borderDivider: palette.zinc200,
  borderStrong: palette.zinc300,
  borderInput: palette.zinc300,
  borderFocus: palette.black,

  // Text
  textPrimary: palette.black,
  textSecondary: palette.zinc500,
  textTertiary: palette.zinc400,
  textOnDark: palette.white,
  textLink: palette.bottleGreen,

  // Controls (monochrome)
  controlFill: palette.black,
  controlFillHover: palette.zinc800,
  controlOn: palette.white,

  // Status
  // Error/destructive (form validation, delete actions) — distinct from
  // clinical SOS, which stays cabernet.
  statusError: palette.red,
  statusErrorTint: palette.redTint,
  statusSOS: palette.cabernet,
  statusWarning: palette.amber,
  // Warning accent for icons and borders — brighter than statusWarning, which
  // stays amber for text where #EB970D lacks contrast.
  statusWarningAccent: palette.marigold,
  statusSafe: palette.bottleGreen,
  statusInfo: palette.cobalt,

  statusSOSTint: palette.cabernetTint,
  statusWarningTint: palette.amberTint,
  statusSafeTint: palette.bottleGreenTint,
  statusInfoTint: palette.cobaltTint,

  statusSOSLine: palette.cabernetLine,
  statusWarningLine: palette.marigold,
  statusSafeLine: palette.bottleGreenLine,
  statusInfoLine: palette.cobaltLine,
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,

  gutterScreen: 20,
  gapCard: 16,
  gapStack: 12,
  gapInline: 8,
  gapSection: 32,
  hitMin: 44,
} as const;

// ─── Radii ───────────────────────────────────────────────────────────────────

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

const SANS = 'DMSans-Regular';
const SANS_MEDIUM = 'DMSans-Medium';
const SERIF = 'DMSerifDisplay-Regular';

export const typography = {
  display: {
    fontFamily: SERIF,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -0.46,
  },
  h1: {
    fontFamily: SANS_MEDIUM,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.36,
  },
  h2: {
    fontFamily: SANS_MEDIUM,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.28,
  },
  h3: {
    fontFamily: SANS_MEDIUM,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.22,
  },
  bodyLg: {
    fontFamily: SANS,
    fontSize: 18,
    lineHeight: 30,
  },
  body: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 27,
  },
  bodySmall: {
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: SANS_MEDIUM,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 20,
  },
} as const;

// ─── Shadows (RN shadow props) ────────────────────────────────────────────────

export const shadow = {
  none: {},
  xs: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;

// ─── Motion ───────────────────────────────────────────────────────────────────

export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

// ─── Backward-compat alias ────────────────────────────────────────────────────
// Existing screens import `spacing` (tokens.old.ts shape). New code should
// use `space` instead; this alias prevents import errors during migration.
export const spacing = {
  xs: space[1],
  sm: space[2],
  md: space[4],
  lg: space[6],
  xl: space[8],
  xxl: space[12],
} as const;
