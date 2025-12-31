import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rinno.ox',
  appName: 'RinnoOX',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: 'YOUR_CLIENT_ID_HERE', // Replaced automatically
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
