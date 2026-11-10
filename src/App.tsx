import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import { LoginScreen } from "./features/auth/LoginScreen";
import { StoreProvider, useStore } from "./features/store/StoreProvider";
import { StoreSetup } from "./features/store/StoreSetup";
import { Shell } from "./features/Shell";
import { Toasts } from "./ui/Toasts";

function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <img src="/icon.svg" alt="" className="size-20 animate-pulse" />
    </div>
  );
}

function StoreGate() {
  const { loaded, memberships, store } = useStore();
  if (!loaded) return <Splash />;
  if (memberships.length === 0) return <StoreSetup />;
  if (!store) return <Splash />;
  return <Shell />;
}

function Root() {
  const { ready, user } = useAuth();
  // Kayıtlı oturum yüklenene kadar giriş ekranı ASLA gösterilmez.
  if (!ready) return <Splash />;
  if (!user) return <LoginScreen />;
  return (
    <StoreProvider key={user.uid}>
      <StoreGate />
    </StoreProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Root />
      <Toasts />
    </AuthProvider>
  );
}
