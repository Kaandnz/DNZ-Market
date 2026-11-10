import { useState, type FormEvent } from "react";
import { useUser } from "../auth/AuthProvider";
import { useStore } from "./StoreProvider";
import { createStore, joinWithInvite, normalizeInviteCode } from "../../data/stores";
import { errorText, toast } from "../../lib/events";

const input =
  "h-14 w-full rounded-2xl border border-stone-300 bg-white px-4 text-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
const primary =
  "h-14 w-full rounded-2xl bg-emerald-700 text-lg font-semibold text-white active:bg-emerald-800 disabled:opacity-50";

/** Yeni market aç veya davet koduyla katıl. İlk girişte ve menüden kullanılır. */
export function StoreForms({ onDone }: { onDone?: () => void }) {
  const user = useUser();
  const { selectStore } = useStore();
  const [storeName, setStoreName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!storeName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createStore(user, storeName);
      selectStore(id);
      toast("Market açıldı.");
      onDone?.();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    if (normalizeInviteCode(code).length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const id = await joinWithInvite(user, code);
      selectStore(id);
      toast("Markete katıldın.");
      onDone?.();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={create} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Yeni market aç</h2>
        <input
          className={input}
          placeholder="Market adı (ör. Deniz Bakkal)"
          value={storeName}
          maxLength={80}
          onChange={(e) => setStoreName(e.target.value)}
        />
        <button className={primary} disabled={busy || !storeName.trim()}>
          Marketi aç
        </button>
      </form>

      <form onSubmit={join} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Davet koduyla katıl</h2>
        <p className="-mt-1 text-sm text-stone-500">Market sahibi menüden "Market ve kişiler" kısmında kod üretir.</p>
        <input
          className={`${input} text-center font-mono text-2xl tracking-[0.3em] uppercase`}
          placeholder="KOD"
          value={code}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          onChange={(e) => setCode(normalizeInviteCode(e.target.value))}
        />
        <button className={primary} disabled={busy || code.length < 6}>
          Katıl
        </button>
      </form>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</p>}
    </div>
  );
}

export function StoreSetup() {
  const user = useUser();
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-6 px-5 py-10">
      <div>
        <h1 className="text-2xl font-bold">Hoş geldin{user.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}</h1>
        <p className="mt-1 text-stone-500">Başlamak için marketini aç ya da sana verilen kodla katıl.</p>
      </div>
      <StoreForms />
    </div>
  );
}
