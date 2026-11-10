import { useMemo } from "react";
import { useProductList } from "../products/useProductList";
import { fold } from "../products/ProductsScreen";
import { formatTL } from "../../lib/money";
import type { Product } from "../../data/types";

const MAX = 8;

/**
 * Satış modunda barkod kutusuna isim yazılınca: eşleşen ürünler hemen altta listelenir,
 * dokununca satışa eklenir (barkodu olmayan ekmek, dökme ürün vb. için).
 * Ürünler telefondaki önbellekten gelir; sunucudan sadece değişenler çekilir.
 */
export function SaleSearch({ storeId, query, onPick }: { storeId: string; query: string; onPick: (p: Product) => void }) {
  const { products, loading } = useProductList(storeId);
  const term = fold(query.trim());

  const results = useMemo(() => {
    if (term.length < 2) return [];
    const hits = products.filter((p) => fold(p.name).includes(term) || p.barcode.includes(term));
    // Adı aranan kelimeyle başlayanlar önce
    hits.sort((a, b) => Number(!fold(a.name).startsWith(term)) - Number(!fold(b.name).startsWith(term)) || a.name.localeCompare(b.name, "tr-TR"));
    return hits.slice(0, MAX);
  }, [products, term]);

  if (term.length < 2) return null;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-200">
      {loading && products.length === 0 ? (
        <div className="px-4 py-3 text-sm text-stone-400">Ürünler yükleniyor…</div>
      ) : results.length === 0 ? (
        <div className="px-4 py-3 text-sm text-stone-500">"{query.trim()}" ile eşleşen ürün yok.</div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {results.map((p) => (
            <li key={p.barcode}>
              <button onClick={() => onPick(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-blue-50">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-600 text-lg font-bold text-white">+</span>
                <span className="min-w-0 flex-1 truncate font-medium text-stone-800">{p.name}</span>
                <span className="shrink-0 font-bold tabular-nums">{formatTL(p.salePrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
