import { MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

// High-contrast, large-type theme: many users are outdoors in bright sun, often with gloves.
export const MIN_TAP = 56;

// Brand colours, sampled from assets/brand/croppr-logo-source.png.
export const BRAND = {
  green: '#17482F', // dark field green: primary actions, text accents (10:1 on white)
  leaf: '#5A8F3A', // light field green
  sun: '#CE5B39', // orange sun
} as const;

const fonts = configureFonts({
  config: {
    bodyLarge: { fontSize: 18, lineHeight: 26, letterSpacing: 0.15, fontWeight: '400', fontFamily: 'System' },
    bodyMedium: {
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: 0.25,
      fontWeight: '400',
      fontFamily: 'System',
    },
    labelLarge: { fontSize: 18, lineHeight: 24, letterSpacing: 0.1, fontWeight: '600', fontFamily: 'System' },
  },
});

export const theme: MD3Theme = {
  ...MD3LightTheme,
  fonts,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND.green,
    onPrimary: '#FFFFFF',
    primaryContainer: '#D7E9DC',
    onPrimaryContainer: '#0B2A1B',
    secondary: '#8D5A00',
    secondaryContainer: '#FFE0A8',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    onSurface: '#111111',
    onSurfaceVariant: '#333333',
    outline: '#5F5F5F',
    error: '#B00020',
  },
};
