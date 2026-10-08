/**
 * Motion tokens, turned 1:1 from design/approved/motion-bible.md into
 * constants. No duration or easing is ever written inline in a component -
 * everything here, or in easings.ts/timelines.ts which build on this file.
 */

/** Timing tokens (ms), motion-bible.md "Timing tokens". */
export const DURATION = {
  instant: 0,
  micro: 120,
  short: 200,
  field: 160,
  medium: 360,
  long: 600,
  scene: 900,
  intro: 10_000,
} as const

/** Point re-layout stagger: 0.6ms per point, by destination-x rank. */
export const STAGGER_MS_PER_POINT = 0.6

/** Critically-damped spring tokens (k = stiffness, c = damping, zeta = 1 by construction). */
export const SPRING = {
  point: { k: 170, c: 26.1 },
  focal: { k: 300, c: 34.6 },
  camera: { k: 90, c: 19.0 },
} as const

/** Colors (design/approved/colors.md). Canvas drawing needs real hex/rgba
 *  strings, not CSS custom properties, so these mirror index.css's :root
 *  tokens. Nine literals; not worth a build-time codegen step. */
export const PALETTE = {
  bg: '#0b1110',
  mint: '#b5ffce',
  ivory: '#f0f3eb',
  coral: '#ff866d',
  gray: '#87928b',
  surface1: '#121a18',
  surface2: '#18221f',
  line: '#24302c',
  grayDim: '#5e6862',
  mint12: 'rgba(181,255,206,0.12)',
  mint22: 'rgba(181,255,206,0.22)',
  mint40: 'rgba(181,255,206,0.40)',
  coral16: 'rgba(255,134,109,0.16)',
  coral38: 'rgba(255,134,109,0.38)',
  coral60: 'rgba(255,134,109,0.60)',
  ivory35: 'rgba(240,243,235,0.35)',
  ivory70: 'rgba(240,243,235,0.70)',
} as const

export const THRESHOLD = 0.1

/** Grid resolution per breakpoint (composition.md / responsive-spec.md). */
export const GRID_RESOLUTION = {
  desktop: { cols: 48, rows: 32, coarseCols: 24, coarseRows: 16 },
  tablet: { cols: 40, rows: 28, coarseCols: 20, coarseRows: 14 },
  mobile: { cols: 32, rows: 24, coarseCols: 16, coarseRows: 12 },
} as const

/** Performance contract (interaction-map.md): downgrade grid if this budget is blown twice. */
export const FULL_GRID_BUDGET_MS = 250

export const TENURE_AXIS = { min: 0, max: 72 } as const
export const CHARGE_AXIS = { min: 18.25, max: 118.75 } as const
