import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ng.edu.noun.acetel.ims',
  appName: 'ACETEL IMS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Option 2: APK always loads the live hosted web app.
    // This means no rebuild is needed when you update the web app,
    // and Capacitor plugins (camera, GPS, push notifications) still work.
    url: 'https://acetel.vims.nou.ng',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a5c36',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#f5a623',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {
      // Android background location permission
    },
    Camera: {
      // For profile photo and logbook attachments
    },
  },
  android: {
    buildOptions: {
      keystorePath: 'acetel.keystore',
      keystoreAlias: 'acetel',
    },
  },
};

export default config;
