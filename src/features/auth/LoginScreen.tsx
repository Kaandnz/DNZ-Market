import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { errorText, toast } from "../../lib/events";
import { MicButton } from "../../ui/MicButton";

/** Giriş sadece e-posta / şifre ile. */
export function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!email.trim()) {
      setError("Önce e-posta adresini yaz.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast("Şifre sıfırlama e-postası gönderildi.");
    } catch (e) {
      setError(errorText(e));
    }
  }

  const input =
    "h-14 w-full rounded-2xl border border-stone-300 bg-white px-4 text-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <img src="/icon.svg" alt="" className="mx-auto mb-4 size-20" />
        <h1 className="text-3xl font-bold">DNZ Bakkal</h1>
        <p className="mt-1 text-stone-500">Barkodu okut, fiyatı gör.</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === "register" && (
          <div className="relative">
            <input className={`${input} pr-12`} placeholder="Adın" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <MicButton onText={setName} className="absolute top-1/2 right-2 -translate-y-1/2" />
          </div>
        )}
        <input
          className={input}
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className={input}
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={6}
          required
        />
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-14 rounded-2xl bg-emerald-700 text-lg font-semibold text-white active:bg-emerald-800 disabled:opacity-60"
        >
          {mode === "login" ? "Giriş yap" : "Kayıt ol"}
        </button>
      </form>

      <div className="flex flex-col items-center gap-2 text-stone-600">
        <button className="py-2 font-medium text-emerald-700" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Hesabın var mı? Giriş yap"}
        </button>
        {mode === "login" && (
          <button className="py-1 text-sm" onClick={reset}>
            Şifremi unuttum
          </button>
        )}
      </div>
      <p className="text-center text-xs text-stone-400">Bir kez giriş yaptıktan sonra bu cihazda hep girişli kalırsın.</p>
    </div>
  );
}
