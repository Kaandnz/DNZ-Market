import { useDeferredValue, useMemo, useState } from "react";
import { useActiveStore } from "../store/StoreProvider";
import { useUser } from "../auth/AuthProvider";
import { useProductList } from "./useProductList";
import { ProductEditSheet } from "./ProductEditSheet";
import { PrintList } from "./PrintList";
import { AddProductSheet } from "./AddProductSheet";
import { uniqueValues } from "../../ui/SuggestInput";
import { MicButton } from "../../ui/MicButton";
import { formatTL } from "../../lib/money";
import { timeAgo } from "../../lib/useOnline";
import { storage } from "../../lib/feedback";
import type { Product } from "../../data/types";

type Sort = "name" | "recent" | "price";
const SORT_KEY = "dnz.productSort";
const NO_CATEGORY = "\u0000yok";
const PAGE = 150;

const SORTS: [Sort, string][] = [
  ["name", "A–Z"],
  ["recent", "Son değişen"],
  ["price", "Fiyat"],
];

const collator = new Intl.Collator("tr-TR", { sensitivity: "base", numeric: true });

/** Aramada Türkçe harf farkını yok say: "sut" yazınca "Süt", "cay" yazınca "Çay" bulunur. */
const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
export function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC")
    .replace(/[çğıöşüâîû]/g, (c) => FOLD[c])
    .replace(/i̇/g, "i");
}

function sortProducts(list: Product[], sort: Sort): Product[] {
  const out = [...list];
  if (sort === "name") out.sort((a, b) => collator.compare(a.name, b.name));
  else if (sort === "price") out.sort((a, b) => b.salePrice - a.salePrice || collator.compare(a.name, b.name));
  else out.sort((a, b) => (b.updatedAt?.toMillis?.() ?? Infinity) - (a.updatedAt?.toMillis?.() ?? Infinity));
  return out;
}

export function ProductsScreen({ initialSearch = "" }: { initialSearch?: string }) {
  const user = useUser();
  const { store, canEdit } = useActiveStore();
  const { products, loading, error, refresh } = useProductList(store.id);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState("");
  const [sort, setSortState] = useState<Sort>(() => (storage.get(SORT_KEY) as Sort) || "name");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const q = useDeferredValue(search.trim());

  function setSort(s: Sort) {
    storage.set(SORT_KEY, s);
    setSortState(s);
    setLimit(PAGE);
  }

  const categories = useMemo(() => uniqueValues(products.map((p) => p.category)), [products]);
  const brands = useMemo(() => uniqueValues(products.map((p) => p.brand)), [products]);

  const visible = useMemo(() => {
    const term = fold(q);
    let filtered = term ? products.filter((p) => fold(p.name).includes(term) || p.barcode.includes(term)) : products;
    if (category) filtered = filtered.filter((p) => (category === NO_CATEGORY ? !p.category : p.category === category));
    return sortProducts(filtered, sort);
  }, [products, q, sort, category]);

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-stone-100 px-4 pt-1 pb-2">
        <div className="relative">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Ürün adı veya barkod ara"
            enterKeyHint="search"
            className="h-12 w-full rounded-2xl border border-stone-300 bg-white pr-20 pl-4 text-base outline-none focus:border-emerald-600"
          />
          <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">
            {search && (
              <button
                onClick={() => setSearch("")}
                className="grid size-8 place-items-center rounded-full text-xl text-stone-400"
                aria-label="Aramayı temizle"
              >
                ×
              </button>
            )}
            <MicButton
              onText={(t) => {
                setSearch(t);
                setLimit(PAGE);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 rounded-xl bg-stone-200 p-1">
            {SORTS.map(([s, label]) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`h-9 flex-1 rounded-lg text-sm font-semibold ${sort === s ? "bg-white shadow" : "text-stone-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.print()}
            disabled={visible.length === 0}
            className="flex h-11 items-center gap-1 rounded-xl bg-stone-800 px-3 text-sm font-semibold text-white active:bg-stone-900 disabled:opacity-40"
          >
            🖨 Yazdır
          </button>
        </div>
        {(categories.length > 0 || canEdit) && (
          <div className="flex items-center gap-2">
            {categories.length > 0 && (
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setLimit(PAGE);
                }}
                className="h-10 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm"
              >
                <option value="">Tüm kategoriler</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={NO_CATEGORY}>Kategorisiz</option>
              </select>
            )}
            {canEdit && (
              <button
                onClick={() => setAdding(true)}
                className="ml-auto h-10 shrink-0 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white active:bg-emerald-800"
              >
                + Ekle
              </button>
            )}
          </div>
        )}
        <div className="flex items-center justify-between px-1 text-sm text-stone-500">
          <span>
            {loading && products.length === 0 ? "Yükleniyor…" : `${visible.length} ürün${q ? ` (toplam ${products.length})` : ""}`}
          </span>
          <button onClick={refresh} className="font-medium text-emerald-700" title="Tüm listeyi sunucudan yeniden çek">
            ↻ Yenile
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      {!loading && products.length === 0 && !error && (
        <div className="rounded-3xl bg-white px-5 py-8 text-center text-stone-500 shadow-sm">
          Henüz ürün yok. Tarama ekranında barkod okuttukça ürünler burada listelenir.
        </div>
      )}

      {products.length > 0 && visible.length === 0 && (
        <div className="rounded-3xl bg-white px-5 py-6 text-center text-stone-500 shadow-sm">"{q}" ile eşleşen ürün yok.</div>
      )}

      {visible.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white shadow-sm">
          {visible.slice(0, limit).map((p) => {
            const updated = p.updatedAt?.toDate?.();
            return (
              <li key={p.barcode}>
                <button onClick={() => setEditing(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-stone-800">{p.name}</div>
                    <div className="truncate text-xs text-stone-400">
                      {p.barcode}
                      {p.category && ` · ${p.category}`}
                      {updated && ` · ${timeAgo(updated)}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-lg font-bold text-emerald-700 tabular-nums">{formatTL(p.salePrice)}</div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > limit && (
        <button onClick={() => setLimit((l) => l + PAGE)} className="py-3 font-medium text-emerald-700">
          Daha fazla göster ({visible.length - limit} ürün daha)
        </button>
      )}

      <ProductEditSheet
        product={editing}
        storeId={store.id}
        uid={user.uid}
        canEdit={canEdit}
        categories={categories}
        brands={brands}
        onClose={() => setEditing(null)}
      />
      <AddProductSheet
        open={adding}
        storeId={store.id}
        uid={user.uid}
        settings={store.settings}
        products={products}
        categories={categories}
        onClose={() => setAdding(false)}
      />

      <PrintList
        storeName={store.name}
        title={[
          "Fiyat listesi",
          category && (category === NO_CATEGORY ? "Kategorisiz" : category),
          q && `"${q}"`,
        ]
          .filter(Boolean)
          .join(" — ")}
        products={visible}
      />
    </div>
  );
}
