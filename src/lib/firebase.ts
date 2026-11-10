import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

const env = import.meta.env;

/** .env.local içinde gerçek proje yoksa ya da VITE_USE_EMULATOR=1 ise yerel Emulator'a bağlanılır. */
export const usingEmulator = env.VITE_USE_EMULATOR === "1" || !env.VITE_FB_PROJECT_ID;

const app = initializeApp(
  usingEmulator
    ? { apiKey: "demo-key", authDomain: "localhost", projectId: "demo-dnz", appId: "demo-app" }
    : {
        apiKey: env.VITE_FB_API_KEY,
        authDomain: env.VITE_FB_AUTH_DOMAIN,
        projectId: env.VITE_FB_PROJECT_ID,
        appId: env.VITE_FB_APP_ID,
        messagingSenderId: env.VITE_FB_MESSAGING_SENDER_ID,
      },
);

/**
 * KESİN KURAL: giriş yapan kullanıcı uygulama tarafından asla çıkarılmaz.
 * Oturum IndexedDB'de kalıcı tutulur (yedek: localStorage). Süresi dolmaz,
 * yenileme anahtarı kendiliğinden eskimez. signOut() yalnızca
 * src/features/settings/SettingsScreen.tsx içindeki onaylı "Çıkış yap" ile çağrılır.
 */
export const auth: Auth = initializeAuth(app, {
  // Giriş sadece e-posta / şifre: Google açılır pencere / yönlendirme kodu yüklenmez.
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});
auth.languageCode = "tr";

/** Çevrimdışı çalışma: veriler cihazda önbelleğe alınır, internet gelince eşitlenir. */
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (usingEmulator) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

/** Tarayıcının depolamayı (oturum + önbellek) kendiliğinden silmemesini iste. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* desteklenmiyorsa sorun değil */
  }
}
