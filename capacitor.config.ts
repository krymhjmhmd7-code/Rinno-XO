import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rinno.ox',
  appName: 'RinnoOX',
  webDir: 'dist',
  server: {
    // للتطوير المحلي: فعّل هذا السطر لتحديث فوري بدون إعادة بناء
    // url: 'http://10.0.2.2:5173',
    // cleartext: true,
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: 'YOUR_CLIENT_ID_HERE', // Replaced automatically
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
