import { useMemo, useState } from "react";
import { fold } from "../products/ProductsScreen";
import { formatTL } from "../../lib/money";
import type { Product } from "../../data/types";

const SHOW = 200;

interface Props {
  products: Product[];
  picked: Set<string>;
  onChange: (next: Set<string>) => void;
}

/** Toplu zam için ürünleri tek tek işaretleme: arama + işaret kutuları. */
export function ProductPicker({ products, picked, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const t = fold(search.trim());
  // Seçim boşalınca (ör. zam uygulandıktan sonra) "Seçilenler" süzgeci kendiliğinden kapanır.
  const showPicked = onlyPicked && picked.size > 0;

  const list = useMemo(() => {
    let l = showPicked ? products.filter((p) => picked.has(p.barcode)) : products;
    if (t) l = l.filter((p) => fold(p.name).includes(t) || p.barcode.includes(t));
    return [...l].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
  }, [products, picked, showPicked, t]);

  const allVisiblePicked = list.length > 0 && list.every((p) => picked.has(p.barcode));

  function toggle(code: string) {
    const n = new Set(picked);
    if (n.has(code)) n.delete(code);
    else n.add(code);
    onChange(n);
  }

  function setVisible(on: boolean) {
    const n = new Set(picked);
    for (const p of list) {
      if (on) n.add(p.barcode);
      else n.delete(p.barcode);
    }
    onChange(n);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Ürün ara (ad ya da barkod)"
        className="h-12 w-full rounded-2xl border border-stone-300 px-4 text-base outline-none focus:border-emerald-600"
      />
      <div className="flex items-center justify-between gap-2 text-sm">
        <button
          onClick={() => setOnlyPicked(!showPicked)}
          disabled={picked.size === 0}
          className={`h-9 rounded-full px-3 font-semibold disabled:opacity-50 ${showPicked ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-700"}`}
        >
          Seçilenler ({picked.size})
        </button>
        <div className="flex gap-1">
          {list.length > 0 && (
            <button onClick={() => setVisible(!allVisiblePicked)} className="h-9 rounded-full bg-stone-100 px-3 font-semibold text-stone-700">
              {allVisiblePicked ? "Görünenleri bırak" : `Görünenleri seç (${list.length})`}
            </button>
          )}
          {picked.size > 0 && (
            <button onClick={() => onChange(new Set())} className="h-9 rounded-full bg-stone-100 px-3 font-semibold text-red-600">
              Temizle
            </button>
          )}
        </div>
      </div>

      <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto overscroll-contain rounded-2xl border border-stone-200">
        {list.length === 0 && (
          <li className="px-4 py-4 text-center text-sm text-stone-500">{showPicked ? "Henüz ürün seçmedin." : "Ürün bulunamadı."}</li>
        )}
        {list.slice(0, SHOW).map((p) => (
          <li key={p.barcode}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 active:bg-stone-50">
              <input type="checkbox" checked={picked.has(p.barcode)} onChange={() => toggle(p.barcode)} className="size-5 shrink-0 accent-emerald-700" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 font-semibold tabular-nums">{formatTL(p.salePrice)}</span>
            </label>
          </li>
        ))}
        {list.length > SHOW && (
          <li className="px-4 py-2 text-center text-xs text-stone-500">… {list.length - SHOW} ürün daha, aramayı daralt.</li>
        )}
      </ul>
    </div>
  );
}
