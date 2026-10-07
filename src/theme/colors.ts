/**
 * Curated, premium color palette for BarberShop mobile & web clients.
 *
 * Designed with a luxury grooming aesthetic:
 * - Brand: Regal Gold & Warm Amber accents
 * - Dark Canvas: Deep Obsidian (#0D1117) & Midnight Slate (#161B22)
 * - Elevated Surfaces: Refined card backgrounds (#21262D)
 * - Semantic states: Emerald green, Crimson red, Amber warning, Azure blue
 */

export const colors = {
  // Brand accents
  brand: {
    primary: '#D4AF37', // Regal Gold
    primaryLight: '#E5C158',
    primaryDark: '#B38F24',
    secondary: '#C08035', // Warm Bronze
    secondaryLight: '#D89950',
    secondaryDark: '#9F621D',
  },

  // Dark Canvas & Surfaces
  canvas: {
    background: '#0D1117',
    surface: '#161B22',
    surfaceElevated: '#21262D',
    surfacePressed: '#30363D',
    border: '#30363D',
    borderSubtle: '#21262D',
  },

  // Typography & Content
  text: {
    primary: '#F0F6FC',
    secondary: '#8B949E',
    muted: '#6E7681',
    inverse: '#0D1117',
    gold: '#D4AF37',
  },

  // Semantic Status Colors
  status: {
    success: '#2EA043',
    successLight: '#3FB950',
    successBg: '#0F2D18',
    error: '#DA3633',
    errorLight: '#F85149',
    errorBg: '#3E1014',
    warning: '#D29922',
    warningLight: '#E3B341',
    warningBg: '#34260A',
    info: '#58A6FF',
    infoLight: '#79C0FF',
    infoBg: '#0D2D50',
  },

  // Appointment & Barber lifecycle states
  appointment: {
    pending: '#D29922',
    confirmed: '#58A6FF',
    in_progress: '#A371F7',
    completed: '#2EA043',
    cancelled: '#DA3633',
    no_show: '#8B949E',
  },

  // Transparent overlays
  overlay: {
    scrim: 'rgba(0, 0, 0, 0.75)',
    goldGlow: 'rgba(212, 175, 55, 0.15)',
    subtle: 'rgba(255, 255, 255, 0.05)',
  },
} as const;

export type ColorTheme = typeof colors;
