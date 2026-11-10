import { useMemo, useState } from "react";
import { useActiveStore } from "../store/StoreProvider";
import { useUser } from "../auth/AuthProvider";
import { useProductList } from "../products/useProductList";
import { fold } from "../products/ProductsScreen";
import { CountSheet } from "./CountSheet";
import { isLowStock } from "../../data/products";
import { formatTL } from "../../lib/money";
import type { Product } from "../../data/types";
import { useHideCost } from "../../lib/prefs";

type Tab = "low" | "all" | "none";

/**
 * Stok: azalanlar, stok tutulan tüm ürünler, stok değeri (alış fiyatıyla).
 * Ürüne dokununca sayım; "Okutarak say" ile tarama ekranı sayım moduna geçer.
 */
export function StockScreen({ onStartCount }: { onStartCount: () => void }) {
  const user = useUser();
  const { store } = useActiveStore();
  const { products, loading } = useProductList(store.id);
  const [tab, setTab] = useState<Tab>("low");
  const [search, setSearch] = useState("");
  const [counting, setCounting] = useState<Product | null>(null);
  const hideCost = useHideCost();
  const minDefault = store.settings.lowStockDefault;

  const tracked = useMemo(() => products.filter((p) => typeof p.stock === "number"), [products]);
  const low = useMemo(
    () => tracked.filter((p) => isLowStock(p, minDefault)).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0) || a.name.localeCompare(b.name, "tr-TR")),
    [tracked, minDefault],
  );
  const untracked = useMemo(() => products.filter((p) => typeof p.stock !== "number"), [products]);
  const value = useMemo(
    () => tracked.reduce((sum, p) => sum + Math.max(0, p.stock ?? 0) * (p.costPrice ?? 0), 0),
    [tracked],
  );
  const missingCost = tracked.filter((p) => !p.costPrice && (p.stock ?? 0) > 0).length;

  const base = tab === "low" ? low : tab === "all" ? [...tracked].sort((a, b) => a.name.localeCompare(b.name, "tr-TR")) : untracked;
  const t = fold(search.trim());
  const list = t ? base.filter((p) => fold(p.name).includes(t) || p.barcode.includes(t)) : base;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="text-sm text-stone-500">Azalan</div>
          <div className={`text-3xl font-bold ${low.length ? "text-red-600" : "text-emerald-700"}`}>{low.length}</div>
        </div>
        {hideCost ? (
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="text-sm text-stone-500">Stoklu ürün</div>
            <div className="text-3xl font-bold">{tracked.length}</div>
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="text-sm text-stone-500">Stok değeri (alış)</div>
            <div className="truncate text-2xl font-bold tabular-nums">{formatTL(value)}</div>
            {missingCost > 0 && <div className="text-[11px] text-stone-400">{missingCost} ürünün alışı yok</div>}
          </div>
        )}
      </div>

      <button
        onClick={onStartCount}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-700 text-lg font-bold text-white active:bg-sky-800"
      >
        📷 Okutarak sayım yap
      </button>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1">
        {(
          [
            ["low", `Azalanlar (${low.length})`],
            ["all", `Stoklu (${tracked.length})`],
            ["none", `Sayılmamış (${untracked.length})`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`h-10 rounded-lg text-sm font-semibold ${tab === k ? "bg-white shadow" : "text-stone-600"}`}>
            {label}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Ürün ara"
        className="h-11 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base outline-none focus:border-emerald-600"
      />

      {loading && products.length === 0 && <div className="py-6 text-center text-stone-400">Yükleniyor…</div>}
      {!loading && list.length === 0 && (
        <div className="rounded-3xl bg-white px-5 py-8 text-center text-stone-500 shadow-sm">
          {tab === "low"
            ? tracked.length
              ? "Azalan ürün yok. 👍"
              : "Henüz stok tutulan ürün yok. Mal Kabul'de adet girince ya da sayım yapınca burada görünür."
            : "Ürün yok."}
        </div>
      )}

      {list.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white shadow-sm">
          {list.slice(0, 300).map((p) => {
            const s = p.stock;
            const isLow = isLowStock(p, minDefault);
            return (
              <li key={p.barcode}>
                <button onClick={() => setCounting(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-stone-800">{p.name}</div>
                    <div className="text-xs text-stone-400">
                      {typeof s === "number" ? `uyarı ${p.minStock ?? minDefault}` : "dokun, say"}
                      {p.category && ` · ${p.category}`}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-2xl font-bold tabular-nums ${
                      typeof s !== "number" ? "text-stone-300" : s <= 0 ? "text-red-600" : isLow ? "text-amber-600" : "text-stone-800"
                    }`}
                  >
                    {typeof s === "number" ? s : "—"}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CountSheet product={counting} storeId={store.id} uid={user.uid} onClose={() => setCounting(null)} />
    </div>
  );
}
