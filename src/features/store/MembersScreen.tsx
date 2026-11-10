import { useEffect, useState } from "react";
import { useUser } from "../auth/AuthProvider";
import { useActiveStore } from "./StoreProvider";
import { StoreForms } from "./StoreSetup";
import { createInvite, setMemberCanEdit, watchMembers } from "../../data/stores";
import type { Member } from "../../data/types";
import { errorText, toast } from "../../lib/events";

export function MembersScreen() {
  const user = useUser();
  const { store, isOwner, memberships, selectStore } = useActiveStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEdit, setInviteEdit] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForms, setShowForms] = useState(false);

  useEffect(() => watchMembers(store.id, setMembers, () => {}), [store.id]);

  async function makeInvite() {
    setBusy(true);
    try {
      setCode(await createInvite(user, store, inviteEdit));
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!code) return;
    const text = `${store.name} için DNZ Bakkal davet kodun: ${code}\n${location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Kopyalandı.", "info");
      }
    } catch {
      /* paylaşım iptal */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">{store.name}</h2>
        <p className="text-sm text-stone-500">{isOwner ? "Sahibisin" : "Çalışansın"}</p>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="mb-2 font-semibold">Kişiler</h3>
        <ul className="divide-y divide-stone-100">
          {members.map((m) => (
            <li key={m.uid} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {m.displayName}
                  {m.uid === user.uid && <span className="text-stone-400"> (sen)</span>}
                </div>
                <div className="text-sm text-stone-500">{m.role === "owner" ? "Sahip" : m.canEditPrice ? "Fiyat değiştirebilir" : "Sadece fiyat görür"}</div>
              </div>
              {isOwner && m.role !== "owner" && (
                <button
                  onClick={() =>
                    setMemberCanEdit(store.id, m.uid, !m.canEditPrice).catch((e) => toast(errorText(e), "error"))
                  }
                  className="shrink-0 rounded-full bg-stone-100 px-3 py-2 text-sm font-medium active:bg-stone-200"
                >
                  {m.canEditPrice ? "Yetkiyi al" : "Yetki ver"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Birini ekle</h3>
          <p className="mb-3 text-sm text-stone-500">Kod üret, karşı taraf kendi telefonunda giriş yapıp bu kodu yazsın. Kod 7 gün geçerli.</p>
          <label className="mb-3 flex items-center gap-3">
            <input type="checkbox" className="size-5 accent-emerald-700" checked={inviteEdit} onChange={(e) => setInviteEdit(e.target.checked)} />
            Fiyat değiştirebilsin
          </label>
          {code ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-emerald-50 p-4">
              <div className="font-mono text-4xl font-bold tracking-[0.3em] text-emerald-800">{code}</div>
              <div className="flex gap-2">
                <button onClick={share} className="rounded-full bg-emerald-700 px-5 py-2 font-semibold text-white">
                  Paylaş
                </button>
                <button onClick={() => setCode(null)} className="rounded-full bg-white px-5 py-2 font-medium">
                  Yeni kod
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={makeInvite}
              disabled={busy}
              className="h-12 w-full rounded-2xl bg-emerald-700 font-semibold text-white active:bg-emerald-800 disabled:opacity-50"
            >
              Davet kodu üret
            </button>
          )}
        </section>
      )}

      {memberships.length > 1 && (
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="mb-2 font-semibold">Market değiştir</h3>
          {memberships.map((m) => (
            <button
              key={m.storeId}
              onClick={() => {
                selectStore(m.storeId);
                toast(`${m.storeName} seçildi.`, "info");
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left ${
                m.storeId === store.id ? "bg-emerald-50 font-semibold text-emerald-800" : "active:bg-stone-100"
              }`}
            >
              {m.storeName}
              {m.storeId === store.id && <span>✓</span>}
            </button>
          ))}
        </section>
      )}

      {showForms ? (
        <StoreForms onDone={() => setShowForms(false)} />
      ) : (
        <button onClick={() => setShowForms(true)} className="py-3 font-medium text-emerald-700">
          + Başka market aç / koda katıl
        </button>
      )}
    </div>
  );
}
