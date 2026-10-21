import { MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

// High-contrast, large-type theme: many users are outdoors in bright sun, often with gloves.
export const MIN_TAP = 56;

const fonts = configureFonts({
  config: {
    bodyLarge: { fontSize: 18, lineHeight: 26, letterSpacing: 0.15, fontWeight: '400', fontFamily: 'System' },
    bodyMedium: { fontSize: 16, lineHeight: 24, letterSpacing: 0.25, fontWeight: '400', fontFamily: 'System' },
    labelLarge: { fontSize: 18, lineHeight: 24, letterSpacing: 0.1, fontWeight: '600', fontFamily: 'System' },
  },
});

export const theme: MD3Theme = {
  ...MD3LightTheme,
  fonts,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1B5E20',
    onPrimary: '#FFFFFF',
    primaryContainer: '#C8E6C9',
    onPrimaryContainer: '#0B2E0F',
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
