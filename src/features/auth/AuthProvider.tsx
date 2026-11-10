import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, requestPersistentStorage } from "../../lib/firebase";

interface AuthState {
  /** Kayıtlı oturum cihazdan geri yüklendi mi? Yüklenmeden giriş ekranı gösterilmez. */
  ready: boolean;
  user: User | null;
}

const Ctx = createContext<AuthState>({ ready: false, user: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: false, user: null });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    // Önce kayıtlı oturumun yüklenmesini bekle; aksi halde girişli kullanıcı
    // bir anlığına giriş ekranını görür.
    auth.authStateReady().then(() => {
      if (cancelled) return;
      unsub = onAuthStateChanged(auth, (user) => {
        setState({ ready: true, user });
        if (user) void requestPersistentStorage();
      });
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

/** Girişli ekranlarda kullanılır; kullanıcı her zaman vardır. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useUser girişsiz çağrıldı");
  return user;
}
