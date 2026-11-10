import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth, usingEmulator } from "../../lib/firebase";
import { useUser } from "../auth/AuthProvider";
import { setSoundEnabled, soundEnabled } from "../../lib/feedback";
import { isIOS, isStandalone } from "../../lib/platform";
import { CameraPicker } from "./CameraPicker";
import { StoreSettingsSection } from "./StoreSettingsSection";
import { setHideCost, useHideCost } from "../../lib/prefs";
import { BackupSection } from "./BackupSection";

export function SettingsScreen() {
  const user = useUser();
  const [sound, setSound] = useState(soundEnabled);
  const [confirming, setConfirming] = useState(false);
  const hideCost = useHideCost();

  return (
    <div className="flex flex-col gap-4">
      <StoreSettingsSection />
      <BackupSection />

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold">Bu cihaz</h3>
        <label className="flex items-center justify-between gap-3 py-2">
          <span>Okutunca bip sesi</span>
          <input
            type="checkbox"
            className="size-6 accent-emerald-700"
            checked={sound}
            onChange={(e) => {
              setSound(e.target.checked);
              setSoundEnabled(e.target.checked);
            }}
          />
        </label>
        <label className="flex items-center justify-between gap-3 py-2">
          <span>
            Alışı gizle
            <span className="block text-xs text-stone-500">Alış fiyatı ve kâr bu telefonda görünmez (Mal Kabul hariç). Müşteri ekranı görse de sorun olmaz.</span>
          </span>
          <input
            type="checkbox"
            className="size-6 shrink-0 accent-emerald-700"
            checked={hideCost}
            onChange={(e) => setHideCost(e.target.checked)}
          />
        </label>
        <CameraPicker />
        {isIOS() && !isStandalone() && (
          <p className="mt-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
            iPhone'da hep girişli kalmak için Safari'de <b>Paylaş → Ana Ekrana Ekle</b> ile uygulamayı ana ekrana ekle ve oradan aç.
          </p>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="mb-1 font-semibold">Hesap</h3>
        <p className="text-stone-600">{user.displayName || "—"}</p>
        <p className="text-sm text-stone-500">{user.email}</p>
        <p className="mt-2 text-xs text-stone-400">Bu cihazda girişin kalıcıdır; sen çıkış yapmadıkça açık kalır.</p>
      </section>

      <p className="text-center text-xs text-stone-400">
        DNZ Bakkal {__APP_VERSION__}
        {usingEmulator && " · test ortamı (emulator)"}
      </p>

      {/* Uygulamadaki TEK çıkış noktası. Başka hiçbir yerde signOut çağrılmaz. */}
      <div className="mt-6">
        {confirming ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
            <p className="mb-3 font-medium text-red-800">Bu cihazdan çıkış yapılsın mı? Tekrar girmek için e-posta ve şifre gerekecek.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="h-12 flex-1 rounded-2xl bg-white font-semibold">
                Vazgeç
              </button>
              <button onClick={() => void signOut(auth)} className="h-12 flex-1 rounded-2xl bg-red-600 font-semibold text-white">
                Çıkış yap
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="w-full py-3 text-sm text-stone-400">
            Çıkış yap
          </button>
        )}
      </div>
    </div>
  );
}
