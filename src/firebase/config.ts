import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, browserLocalPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

// Firebase configuration from environment variables
// NEVER hardcode credentials in source code - use .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const existingApps = getApps();
const app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);

// Initialize Analytics only when supported and the device is online, so we don't
// flood the console with network errors while offline.
if (typeof window !== 'undefined' && firebaseConfig.measurementId && navigator.onLine) {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        try {
          getAnalytics(app);
        } catch {
          // Analytics is non-critical; ignore initialization failures.
        }
      }
    })
    .catch(() => {
      // Ignore analytics support-check failures (e.g. offline).
    });
}

// Suppress uncaught errors from analytics script loading failures.
// getAnalytics() may throw asynchronously (e.g. ERR_NAME_NOT_RESOLVED) after
// the isAnalyticsSupported() check passes, because the actual network request
// happens inside the Firebase SDK. These are non-critical and should not pollute
// the console.
if (typeof window !== 'undefined') {
  const originalError = window.onerror;
  window.addEventListener('error', (event) => {
    const target = event.target as EventTarget | null;
    if (target instanceof HTMLScriptElement && target.src.includes('google-analytics.com')) {
      // Silently suppress analytics script load errors
      event.stopPropagation();
    }
  }, true);

  // Also catch unhandled promise rejections from analytics
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && typeof reason === 'object' && reason.message?.includes?.('google-analytics')) {
      event.preventDefault();
    }
  });
}

// Initialize auth with explicit local persistence to maintain session across refreshes
export const auth = getAuth(app);
auth.setPersistence(browserLocalPersistence).catch((error) => {
  console.warn('Failed to set auth persistence:', error);
});

export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);
export const database = getDatabase(app);

// Initialize Firestore with an offline-first persistent cache so the app can
// serve previously loaded data when the network is unavailable, instead of
// repeatedly failing Listen requests. Falls back to the default in-memory
// instance if persistence cannot be enabled (e.g. unsupported browser).
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

export default app;
