import { useEffect, useMemo, useRef, useState } from "react";
import { useActiveStore } from "../store/StoreProvider";
import { useUser } from "../auth/AuthProvider";
import { useProductList } from "../products/useProductList";
import { fold } from "../products/ProductsScreen";
import { LabelSheet, LABEL_SIZES, type LabelSize } from "./LabelSheet";
import { markLabelsPrinted } from "../../data/importExport";
import { formatTL } from "../../lib/money";
import { storage } from "../../lib/feedback";
import { toast } from "../../lib/events";
import { MicButton } from "../../ui/MicButton";

const SIZE_KEY = "dnz.labelSize";

/**
 * Raf etiketleri: fiyatı/adı değişip etiketi basılmamış ürünler hazır seçili gelir.
 * İstenen başka ürün de aranıp eklenebilir. Yazdırdıktan sonra "basıldı" işaretlenir.
 */
export function LabelsScreen() {
  const user = useUser();
  const { store } = useActiveStore();
  const { products, loading } = useProductList(store.id);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [size, setSizeState] = useState<LabelSize>(() => (storage.get(SIZE_KEY) as LabelSize) || "small");
  const [askPrinted, setAskPrinted] = useState(false);
  const initialized = useRef(false);

  const pending = useMemo(() => products.filter((p) => p.labelPending), [products]);

  // Açılışta basılmayı bekleyenleri seçili getir (bir kez).
  useEffect(() => {
    if (initialized.current || loading) return;
    initialized.current = true;
    setSelected(new Set(pending.map((p) => p.barcode)));
    if (pending.length === 0) setTab("all");
  }, [loading, pending]);

  // Yazdırma penceresi kapanınca "basıldı mı?" sor.
  useEffect(() => {
    const after = () => setAskPrinted(true);
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);

  function setSize(s: LabelSize) {
    storage.set(SIZE_KEY, s);
    setSizeState(s);
  }

  const base = tab === "pending" ? pending : products;
  const t = fold(search.trim());
  const list = useMemo(
    () =>
      (t ? base.filter((p) => fold(p.name).includes(t) || p.barcode.includes(t)) : base)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "tr-TR")),
    [base, t],
  );
  const chosen = useMemo(
    () => products.filter((p) => selected.has(p.barcode)).sort((a, b) => a.name.localeCompare(b.name, "tr-TR")),
    [products, selected],
  );
  const perPage = LABEL_SIZES.find((s) => s.value === size)!.perPage;
  const pages = Math.ceil(chosen.length / perPage);

  function toggle(code: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  function selectAllVisible(on: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      for (const p of list) {
        if (on) n.add(p.barcode);
        else n.delete(p.barcode);
      }
      return n;
    });
  }

  function confirmPrinted() {
    const done = chosen.filter((p) => p.labelPending);
    markLabelsPrinted(store.id, user.uid, done);
    toast(`${done.length} etiket basıldı olarak işaretlendi.`);
    setSelected(new Set());
    setAskPrinted(false);
  }

  const allVisibleSelected = list.length > 0 && list.every((p) => selected.has(p.barcode));

  return (
    <div className="flex flex-col gap-3 pb-24">
      {askPrinted && chosen.length > 0 && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="mb-3 font-medium text-emerald-900">Etiketler basıldı mı? Basıldıysa listeden çıkarayım.</p>
          <div className="flex gap-2">
            <button onClick={() => setAskPrinted(false)} className="h-11 flex-1 rounded-xl bg-white font-semibold">
              Hayır
            </button>
            <button onClick={confirmPrinted} className="h-11 flex-1 rounded-xl bg-emerald-700 font-semibold text-white">
              Evet, basıldı
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1">
        <button onClick={() => setTab("pending")} className={`h-10 rounded-lg text-sm font-semibold ${tab === "pending" ? "bg-white shadow" : "text-stone-600"}`}>
          Fiyatı değişenler ({pending.length})
        </button>
        <button onClick={() => setTab("all")} className={`h-10 rounded-lg text-sm font-semibold ${tab === "all" ? "bg-white shadow" : "text-stone-600"}`}>
          Tüm ürünler
        </button>
      </div>

      <div className="relative">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ürün ara"
          className="h-11 w-full rounded-2xl border border-stone-300 bg-white pr-12 pl-4 text-base outline-none focus:border-emerald-600"
        />
        <MicButton onText={setSearch} className="absolute top-1/2 right-1 -translate-y-1/2" />
      </div>

      {loading && products.length === 0 && <div className="py-6 text-center text-stone-400">Yükleniyor…</div>}
      {!loading && list.length === 0 && (
        <div className="rounded-3xl bg-white px-5 py-8 text-center text-stone-500 shadow-sm">
          {tab === "pending" ? "Basılmayı bekleyen etiket yok. Fiyat değişince burada çıkar." : "Ürün yok."}
        </div>
      )}

      {list.length > 0 && (
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <button onClick={() => selectAllVisible(!allVisibleSelected)} className="flex w-full items-center gap-3 border-b border-stone-100 px-4 py-3 text-left text-sm font-semibold text-emerald-700">
            <input type="checkbox" readOnly checked={allVisibleSelected} className="size-5 accent-emerald-700" />
            {allVisibleSelected ? "Hiçbirini seçme" : `Hepsini seç (${list.length})`}
          </button>
          <ul className="divide-y divide-stone-100">
            {list.slice(0, 300).map((p) => (
              <li key={p.barcode}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 active:bg-stone-50">
                  <input type="checkbox" checked={selected.has(p.barcode)} onChange={() => toggle(p.barcode)} className="size-5 shrink-0 accent-emerald-700" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatTL(p.salePrice)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chosen.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="text-sm font-medium text-stone-600">Etiket boyutu</div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1">
            {LABEL_SIZES.map((s) => (
              <button key={s.value} onClick={() => setSize(s.value)} className={`h-10 rounded-lg text-sm font-semibold ${size === s.value ? "bg-white shadow" : "text-stone-600"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="text-sm text-stone-500">Önizleme (ilk sayfa):</div>
          <div className="overflow-hidden">
            <LabelSheet storeName={store.name} products={chosen} size={size} preview />
          </div>
        </section>
      )}

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => window.print()}
            className="h-14 w-full rounded-2xl bg-stone-900 text-lg font-bold text-white shadow-lg active:bg-black"
          >
            🖨 {chosen.length} etiket yazdır · {pages} sayfa
          </button>
        </div>
      )}
    </div>
  );
}
