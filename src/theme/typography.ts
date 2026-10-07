import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'sans-serif',
});

export const typography = {
  fontFamily,

  sizes: {
    display: 32,
    h1: 28,
    h2: 24,
    h3: 20,
    h4: 18,
    body: 16,
    subtext: 14,
    caption: 12,
    tiny: 10,
  },

  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },

  lineHeights: {
    display: 40,
    h1: 34,
    h2: 30,
    h3: 26,
    h4: 24,
    body: 22,
    subtext: 18,
    caption: 16,
    tiny: 14,
  },
} as const;
