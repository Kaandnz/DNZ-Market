import { useEffect, useMemo, useState } from "react";
import { useActiveStore } from "../store/StoreProvider";
import { useUser } from "../auth/AuthProvider";
import { useProductList } from "../products/useProductList";
import { fold } from "../products/ProductsScreen";
import { uniqueValues } from "../../ui/SuggestInput";
import { applyBulk, computeBulk, undoableItems, undoBulk, watchBulkOps, type BulkOp, type BulkRule } from "../../data/bulk";
import { ROUNDING_OPTIONS, formatTL, parseTL, type Rounding } from "../../lib/money";
import { timeAgo } from "../../lib/useOnline";
import { toast } from "../../lib/events";
import { beepSaved } from "../../lib/feedback";

type Scope = "all" | "category" | "brand" | "search";
const PREVIEW = 60;

/**
 * Toplu Zam: hangi ürünler (hepsi / kategori / marka / arama) → zam ya da indirim,
 * % ya da ₺ → yuvarlama → önizleme → uygula. Son işlemler geri alınabilir.
 */
export function BulkScreen() {
  const user = useUser();
  const { store } = useActiveStore();
  const { products, loading } = useProductList(store.id);

  const [scope, setScope] = useState<Scope>("all");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<BulkRule["direction"]>("up");
  const [kind, setKind] = useState<BulkRule["kind"]>("pct");
  const [amountText, setAmountText] = useState("");
  const [rounding, setRounding] = useState<Rounding>(store.settings.rounding);
  const [confirming, setConfirming] = useState(false);
  const [ops, setOps] = useState<BulkOp[]>([]);
  const [undoing, setUndoing] = useState<string | null>(null);

  useEffect(() => watchBulkOps(store.id, setOps), [store.id]);

  const categories = useMemo(() => uniqueValues(products.map((p) => p.category)), [products]);
  const brands = useMemo(() => uniqueValues(products.map((p) => p.brand)), [products]);

  const selected = useMemo(() => {
    if (scope === "category") return category ? products.filter((p) => p.category === category) : [];
    if (scope === "brand") return brand ? products.filter((p) => p.brand === brand) : [];
    if (scope === "search") {
      const t = fold(search.trim());
      return t ? products.filter((p) => fold(p.name).includes(t)) : [];
    }
    return products;
  }, [products, scope, category, brand, search]);

  const amount = kind === "pct" ? Number(amountText.replace(",", ".")) : parseTL(amountText) ?? NaN;
  const rule: BulkRule = { direction, kind, amount: Number.isFinite(amount) ? amount : 0, rounding };
  const items = useMemo(
    () => (rule.amount > 0 ? computeBulk(selected, rule) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, direction, kind, rule.amount, rounding],
  );
  const tooBig = kind === "pct" && rule.amount > (direction === "up" ? 300 : 90);

  const scopeLabel =
    scope === "category" ? category : scope === "brand" ? brand : scope === "search" ? `"${search.trim()}"` : "Tüm ürünler";
  const ruleLabel = `${direction === "up" ? "+" : "−"}${kind === "pct" ? `%${amountText}` : formatTL(rule.amount)}`;
  const current = useMemo(() => new Map(products.map((p) => [p.barcode, p])), [products]);

  function apply() {
    if (items.length === 0 || tooBig) return;
    applyBulk(store.id, user.uid, items, `${scopeLabel} ${ruleLabel}`);
    beepSaved();
    toast(`${items.length} ürünün fiyatı değişti.`);
    setConfirming(false);
    setAmountText("");
  }

  function undo(op: BulkOp) {
    const n = undoBulk(store.id, user.uid, op, current);
    const skipped = op.items.length - n;
    toast(`${n} ürün eski fiyatına döndü${skipped ? ` (${skipped} ürün sonradan değiştiği için dokunulmadı)` : ""}.`, "info");
    setUndoing(null);
  }

  const chip = (on: boolean) =>
    `h-10 rounded-xl px-3 text-sm font-semibold ${on ? "bg-stone-800 text-white" : "bg-white text-stone-700 shadow-sm"}`;
  const select = "h-12 w-full rounded-2xl border border-stone-300 bg-white px-3 text-base";

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold">1. Hangi ürünler?</h3>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Hepsi"],
              ["category", "Kategori"],
              ["brand", "Marka"],
              ["search", "İsimde geçen"],
            ] as const
          ).map(([s, label]) => (
            <button key={s} onClick={() => setScope(s)} className={chip(scope === s)}>
              {label}
            </button>
          ))}
        </div>
        {scope === "category" &&
          (categories.length ? (
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={select}>
              <option value="">Kategori seç</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-stone-500">Henüz kategorisi olan ürün yok. Ürünler'de ürüne dokunup kategori yazabilirsin.</p>
          ))}
        {scope === "brand" &&
          (brands.length ? (
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className={select}>
              <option value="">Marka seç</option>
              {brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-stone-500">Henüz markası olan ürün yok.</p>
          ))}
        {scope === "search" && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ör. sigara, ekmek, cola"
            className="h-12 w-full rounded-2xl border border-stone-300 px-4 text-base outline-none focus:border-emerald-600"
          />
        )}
        <p className="text-sm text-stone-500">{loading && products.length === 0 ? "Ürünler yükleniyor…" : `${selected.length} ürün seçili`}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold">2. Ne kadar?</h3>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
          <button onClick={() => setDirection("up")} className={`h-10 rounded-lg font-semibold ${direction === "up" ? "bg-red-600 text-white" : "text-stone-600"}`}>
            Zam ↑
          </button>
          <button onClick={() => setDirection("down")} className={`h-10 rounded-lg font-semibold ${direction === "down" ? "bg-emerald-700 text-white" : "text-stone-600"}`}>
            İndirim ↓
          </button>
        </div>
        <div className="flex gap-2">
          <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
            <button onClick={() => setKind("pct")} className={`h-10 w-12 rounded-lg font-bold ${kind === "pct" ? "bg-white shadow" : "text-stone-500"}`}>
              %
            </button>
            <button onClick={() => setKind("tl")} className={`h-10 w-12 rounded-lg font-bold ${kind === "tl" ? "bg-white shadow" : "text-stone-500"}`}>
              ₺
            </button>
          </div>
          <input
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder={kind === "pct" ? "ör. 10" : "ör. 2,50"}
            className="h-12 min-w-0 flex-1 rounded-2xl border border-stone-300 px-4 text-xl font-bold tabular-nums outline-none focus:border-emerald-600"
          />
        </div>
        {tooBig && <p className="text-sm font-medium text-red-600">Bu oran çok yüksek görünüyor, kontrol et.</p>}
        <div>
          <div className="mb-1 text-sm font-medium text-stone-600">Yuvarlama</div>
          <div className="grid grid-cols-5 gap-1 rounded-xl bg-stone-100 p-1">
            {ROUNDING_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setRounding(o.value)}
                className={`h-9 rounded-lg text-sm font-semibold ${rounding === o.value ? "bg-white shadow" : "text-stone-600"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm">
          <h3 className="font-semibold">3. Önizleme · {items.length} ürün değişecek</h3>
          <ul className="divide-y divide-stone-100">
            {items.slice(0, PREVIEW).map((it) => (
              <li key={it.barcode} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-stone-700">{it.name}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="text-stone-400 line-through">{formatTL(it.oldSale)}</span>{" "}
                  <b className={it.newSale > it.oldSale ? "text-red-600" : "text-emerald-700"}>{formatTL(it.newSale)}</b>
                </span>
              </li>
            ))}
          </ul>
          {items.length > PREVIEW && <p className="text-center text-sm text-stone-500">… ve {items.length - PREVIEW} ürün daha</p>}

          {confirming ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="mb-3 font-medium text-amber-900">
                {items.length} ürünün fiyatı değişecek ({scopeLabel}, {ruleLabel}). Emin misin? Sonradan geri alabilirsin.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="h-12 flex-1 rounded-xl bg-white font-semibold">
                  Vazgeç
                </button>
                <button onClick={apply} className="h-12 flex-1 rounded-xl bg-red-600 font-semibold text-white">
                  Uygula
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={tooBig}
              className="h-14 rounded-2xl bg-stone-900 text-lg font-bold text-white active:bg-black disabled:opacity-40"
            >
              {items.length} ürüne uygula
            </button>
          )}
        </section>
      )}

      {ops.length > 0 && (
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h3 className="mb-1 font-semibold">Son toplu işlemler</h3>
          <ul className="divide-y divide-stone-100">
            {ops.map((op) => {
              const can = !op.undone ? undoableItems(op.items, current).length : 0;
              return (
                <li key={op.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{op.label}</div>
                    <div className="text-xs text-stone-500">
                      {op.count} ürün · {op.at ? timeAgo(op.at) : "gönderiliyor…"}
                      {op.undone && " · geri alındı"}
                    </div>
                  </div>
                  {!op.undone &&
                    (undoing === op.id ? (
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => setUndoing(null)} className="h-10 rounded-xl bg-stone-100 px-3 text-sm font-semibold">
                          Vazgeç
                        </button>
                        <button onClick={() => undo(op)} className="h-10 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white">
                          {can} ürünü geri al
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setUndoing(op.id)}
                        disabled={can === 0}
                        className="h-10 shrink-0 rounded-xl bg-stone-100 px-3 text-sm font-semibold text-stone-800 disabled:opacity-40"
                      >
                        ↶ Geri al
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
