import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Scanner } from "../../scanner/Scanner";
import { useWedgeScanner } from "../../scanner/useWedgeScanner";
import { EditPriceSheet } from "./EditPriceSheet";
import { NewProductSheet, type NewProductResult } from "./NewProductSheet";
import { ReceiveSheet, type ReceiveResult } from "./ReceiveSheet";
import { CountSheet } from "../stock/CountSheet";
import { useActiveStore } from "../store/StoreProvider";
import { useUser } from "../auth/AuthProvider";
import { completeSale, savePrice, watchProduct, type ProductState } from "../../data/products";
import type { Product } from "../../data/types";
import { formatPct, formatTL, marginPct } from "../../lib/money";
import { normalizeBarcode } from "../../lib/barcode";
import { beepSaved, beepScan, beepUnknown, storage, unlockAudio } from "../../lib/feedback";
import { toast } from "../../lib/events";
import { timeAgo } from "../../lib/useOnline";
import { useWakeLock } from "../../lib/useWakeLock";
import { isIOS, isStandalone } from "../../lib/platform";
import { useHideCost } from "../../lib/prefs";
import { EMPTY_CART, addToCart, setQty, type Cart } from "../../lib/cart";
import { SalePanel } from "./SalePanel";
import { SaleSearch } from "./SaleSearch";
import { MicButton } from "../../ui/MicButton";

/** Barkodlar rakam / büyük harf; boşluk, küçük harf ya da Türkçe harf varsa ürün adıdır. */
const isNameQuery = (t: string) => /[\sa-zçğıöşüÇĞİÖŞÜ]/.test(t);

type Mode = "view" | "change" | "receive" | "sale";
const MODES: [Mode, string, string][] = [
  ["view", "Fiyat Gör", "bg-white text-stone-900"],
  ["change", "Değiştir", "bg-amber-500 text-white"],
  ["receive", "Mal Kabul", "bg-sky-700 text-white"],
  ["sale", "Satış", "bg-blue-600 text-white"],
];
/** Fiyat değiştirme yetkisi olmayan çalışan sadece bakar ve satış yapar. */
const STAFF_MODES: Mode[] = ["view", "sale"];
const LOADING: ProductState = { status: "loading" };
const MODE_KEY = "dnz.mode";
const IOS_HINT_KEY = "dnz.iosHintDone";

interface Recent {
  barcode: string;
  name: string;
  salePrice: number;
}

interface ScanProps {
  blocked: boolean;
  /** Stok ekranından açılan sayım modu: okut → raftaki adedi yaz. */
  countMode?: boolean;
  onExitCount?: () => void;
  /** Barkod kutusuna isim yazılırsa Ürünler'de ara. */
  onSearchName?: (text: string) => void;
}

export function ScanScreen({ blocked, countMode = false, onExitCount, onSearchName }: ScanProps) {
  const user = useUser();
  const { store, canEdit } = useActiveStore();

  const [mode, setModeState] = useState<Mode>(() => {
    const m = storage.get(MODE_KEY);
    return m === "change" || m === "receive" || m === "sale" ? m : "view";
  });
  const [barcode, setBarcode] = useState<string | null>(null);
  // Durum, ait olduğu barkodla birlikte tutulur: yeni okutmada eski ürünün durumu kullanılmasın.
  const [watched, setWatched] = useState<{ barcode: string; state: ProductState } | null>(null);
  const state: ProductState = watched && watched.barcode === barcode ? watched.state : LOADING;
  const [scanSeq, setScanSeq] = useState(0);
  const [sheet, setSheet] = useState<"edit" | "new" | "receive" | "count" | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [manual, setManual] = useState("");
  const [iosHint, setIosHint] = useState(() => isIOS() && !isStandalone() && !storage.get(IOS_HINT_KEY));
  const pendingOpen = useRef(false);
  const hideCost = useHideCost();
  const stockOn = store.settings.stockEnabled;

  // Satış sepeti: uygulama kapanıp açılsa da kaybolmasın diye telefonda saklanır.
  const cartKey = `dnz.cart.${store.id}`;
  const [cart, setCartState] = useState<Cart>(() => {
    try {
      return JSON.parse(storage.get(cartKey) || "null") ?? EMPTY_CART;
    } catch {
      return EMPTY_CART;
    }
  });
  const setCart = useCallback(
    (update: (c: Cart) => Cart) =>
      setCartState((c) => {
        const next = update(c);
        storage.set(cartKey, JSON.stringify(next));
        return next;
      }),
    [cartKey],
  );

  const effectiveMode: Mode = canEdit ? mode : STAFF_MODES.includes(mode) ? mode : "view";
  const visibleModes = canEdit ? MODES : MODES.filter(([m]) => STAFF_MODES.includes(m));
  const paused = blocked || sheet !== null;

  useWakeLock(!blocked);

  function setMode(m: Mode) {
    storage.set(MODE_KEY, m);
    setModeState(m);
  }

  // Okutulan ürünü izle (önbellekten anında, sonra sunucudan; başka cihazdaki değişiklik de gelir).
  useEffect(() => {
    if (!barcode) return;
    return watchProduct(store.id, barcode, (s) => setWatched({ barcode, state: s }));
  }, [store.id, barcode]);

  // Okutmadan sonra moda göre doğru pencereyi aç.
  useEffect(() => {
    if (!pendingOpen.current || !barcode) return;
    if (state.status === "loading") return;
    pendingOpen.current = false;
    if (state.status === "found") {
      const p = state.product;
      if (countMode) setSheet("count");
      else if (effectiveMode === "sale")
        setCart((c) => addToCart(c, { barcode: p.barcode, name: p.name, price: p.salePrice, tracked: stockOn && typeof p.stock === "number" }));
      else if (effectiveMode === "change") setSheet("edit");
      else if (effectiveMode === "receive") setSheet("receive");
    } else {
      beepUnknown();
      setSheet("new");
    }
  }, [state, barcode, effectiveMode, scanSeq, countMode, setCart]);

  // Son okutulanlar
  useEffect(() => {
    if (state.status !== "found") return;
    const p = state.product;
    setRecent((list) =>
      [{ barcode: p.barcode, name: p.name, salePrice: p.salePrice }, ...list.filter((r) => r.barcode !== p.barcode)].slice(0, 5),
    );
  }, [state]);

  const onDetected = useCallback((code: string) => {
    beepScan();
    pendingOpen.current = true;
    setSheet(null);
    setBarcode(code);
    // Aynı ürün tekrar okutulsa da pencere açılsın.
    setScanSeq((n) => n + 1);
  }, []);

  useWedgeScanner(!paused, onDetected);

  const saleSearching = effectiveMode === "sale" && !countMode && isNameQuery(manual.trim());

  function addProductToSale(p: Product) {
    beepScan();
    setCart((c) => addToCart(c, { barcode: p.barcode, name: p.name, price: p.salePrice, tracked: stockOn && typeof p.stock === "number" }));
    setManual("");
    (document.activeElement as HTMLElement | null)?.blur();
    toast(`Eklendi: ${p.name}`, "info");
  }

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const text = manual.trim();
    // Satış modunda isim aranırsa sonuçlar kutunun altında listelenir; klavyeyi kapat yeter.
    if (saleSearching) {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    // Barkodlar rakam / büyük harften oluşur. Boşluk, küçük harf ya da Türkçe harf varsa
    // bu bir ürün adıdır: Ürünler'de ara.
    if (onSearchName && isNameQuery(text)) {
      setManual("");
      (document.activeElement as HTMLElement | null)?.blur();
      onSearchName(text);
      return;
    }
    const code = normalizeBarcode(manual);
    if (!code) {
      toast("Geçerli bir barkod yaz.", "error");
      return;
    }
    setManual("");
    (document.activeElement as HTMLElement | null)?.blur();
    onDetected(code);
  }

  const product: Product | null = state.status === "found" ? state.product : null;

  function saveEdit(p: { salePrice: number; costPrice?: number }) {
    if (!product) return;
    savePrice({ storeId: store.id, uid: user.uid, barcode: product.barcode, existing: product, ...p, source: "manual" });
    beepSaved();
    toast(`Kaydedildi: ${formatTL(p.salePrice)}`);
    setSheet(null);
  }

  function saveReceive(r: ReceiveResult) {
    if (!product) return;
    savePrice({
      storeId: store.id,
      uid: user.uid,
      barcode: product.barcode,
      existing: product,
      salePrice: r.salePrice,
      ...(r.costPrice !== undefined ? { costPrice: r.costPrice } : {}),
      qty: r.qty,
      source: "receiving",
    });
    beepSaved();
    const parts = [r.qty > 0 ? `+${r.qty} adet` : "", r.salePrice !== product.salePrice ? `satış ${formatTL(r.salePrice)}` : ""];
    toast(`Kaydedildi ${parts.filter(Boolean).join(" · ")}`.trim());
    setSheet(null);
  }

  function saveNew(p: NewProductResult) {
    if (!barcode) return;
    savePrice({
      storeId: store.id,
      uid: user.uid,
      barcode,
      existing: null,
      name: p.name,
      salePrice: p.salePrice,
      ...(p.costPrice !== undefined ? { costPrice: p.costPrice } : {}),
      qty: p.qty,
      ...(p.brand ? { brand: p.brand } : {}),
      source: "new",
      shareToCatalog: p.shareToCatalog,
    });
    beepSaved();
    toast(p.qty ? `Ürün eklendi · ${p.qty} adet` : "Ürün eklendi.");
    setSheet(null);
    // Satış modunda yeni eklenen ürün sepete de girsin.
    if (effectiveMode === "sale" && !countMode) {
      setCart((c) => addToCart(c, { barcode, name: p.name, price: p.salePrice, tracked: !!p.qty }));
    }
  }

  function finishSale() {
    const total = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
    const dropped = canEdit && stockOn ? completeSale(store.id, user.uid, cart.items) : 0;
    beepSaved();
    toast(`Satış: ${formatTL(total)}${dropped ? ` · ${dropped} ürün stoktan düştü` : ""}`);
    setCart(() => EMPTY_CART);
  }

  return (
    <div className="flex flex-col gap-3" onPointerDown={unlockAudio}>
      {iosHint && (
        <div className="flex items-start gap-3 rounded-2xl bg-sky-50 p-3 text-sm text-sky-900">
          <span className="text-xl">📌</span>
          <p className="flex-1">
            Hep girişli kalmak ve tam ekran kullanmak için Safari'de <b>Paylaş</b> düğmesine, sonra <b>Ana Ekrana Ekle</b>'ye dokun.
          </p>
          <button
            className="rounded-full bg-sky-100 px-3 py-1 font-medium"
            onClick={() => {
              storage.set(IOS_HINT_KEY, "1");
              setIosHint(false);
            }}
          >
            Tamam
          </button>
        </div>
      )}

      {countMode && (
        <div className="flex items-center gap-3 rounded-2xl bg-sky-700 px-4 py-3 text-white">
          <div className="flex-1">
            <div className="font-bold">📦 Sayım modu</div>
            <div className="text-sm text-sky-100">Ürünü okut, raftaki adedi yaz.</div>
          </div>
          <button onClick={onExitCount} className="h-10 rounded-xl bg-white px-4 font-semibold text-sky-800">
            Bitir
          </button>
        </div>
      )}

      {!countMode && (
        <div
          className="grid gap-1 rounded-2xl bg-stone-200 p-1"
          style={{ gridTemplateColumns: `repeat(${visibleModes.length}, minmax(0, 1fr))` }}
        >
          {visibleModes.map(([m, label, on]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`h-12 rounded-xl px-1 text-[15px] leading-tight font-semibold transition ${effectiveMode === m ? `${on} shadow` : "text-stone-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <Scanner paused={paused} hidden={blocked} onDetected={onDetected} />

      {effectiveMode === "sale" && !countMode ? (
        <SalePanel
          cart={cart}
          canEdit={canEdit && stockOn}
          onQty={(code, q) => setCart((c) => setQty(c, code, q))}
          onClear={() => setCart(() => EMPTY_CART)}
          onFinish={finishSale}
        />
      ) : (
        <ResultCard
          barcode={barcode}
          state={state}
          canEdit={canEdit}
          hideCost={hideCost}
          showStock={stockOn}
          mode={effectiveMode}
          onEdit={() => setSheet(effectiveMode === "receive" ? "receive" : "edit")}
          onAdd={() => setSheet("new")}
        />
      )}

      <form onSubmit={submitManual} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            enterKeyHint="search"
            placeholder={onSearchName ? "Barkod yaz ya da ürün ara" : "Barkodu elle yaz"}
            className="h-14 w-full rounded-2xl border border-stone-300 bg-white pr-12 pl-4 text-lg outline-none focus:border-emerald-600"
          />
          <MicButton onText={setManual} className="absolute top-1/2 right-2 -translate-y-1/2" />
        </div>
        <button className="h-14 rounded-2xl bg-stone-800 px-5 font-semibold text-white active:bg-stone-900 disabled:opacity-40" disabled={!manual.trim()}>
          Bul
        </button>
      </form>

      {saleSearching && <SaleSearch storeId={store.id} query={manual} onPick={addProductToSale} />}

      {recent.length > 1 && effectiveMode !== "sale" && (
        <div className="rounded-2xl bg-white p-2 shadow-sm">
          <div className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-stone-400 uppercase">Son okutulanlar</div>
          {recent.slice(1).map((r) => (
            <button
              key={r.barcode}
              onClick={() => {
                pendingOpen.current = false;
                setBarcode(r.barcode);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left active:bg-stone-100"
            >
              <span className="truncate text-stone-700">{r.name}</span>
              <span className="shrink-0 font-semibold tabular-nums">{formatTL(r.salePrice)}</span>
            </button>
          ))}
        </div>
      )}

      <EditPriceSheet
        product={sheet === "edit" ? product : null}
        settings={store.settings}
        hideCost={hideCost}
        onClose={() => setSheet(null)}
        onSave={saveEdit}
      />
      <CountSheet product={sheet === "count" ? product : null} storeId={store.id} uid={user.uid} onClose={() => setSheet(null)} />
      <ReceiveSheet
        product={sheet === "receive" ? product : null}
        settings={store.settings}
        withStock={stockOn}
        onClose={() => setSheet(null)}
        onSave={saveReceive}
      />
      <NewProductSheet
        barcode={sheet === "new" ? barcode : null}
        canEdit={canEdit}
        settings={store.settings}
        hideCost={hideCost}
        withQty={countMode || effectiveMode === "receive"}
        withStock={stockOn}
        offline={state.status === "unknown-offline"}
        onClose={() => setSheet(null)}
        onSave={saveNew}
      />
    </div>
  );
}

function ResultCard({
  barcode,
  state,
  canEdit,
  hideCost,
  showStock,
  mode,
  onEdit,
  onAdd,
}: {
  barcode: string | null;
  state: ProductState;
  canEdit: boolean;
  hideCost: boolean;
  showStock: boolean;
  mode: Mode;
  onEdit: () => void;
  onAdd: () => void;
}) {
  if (!barcode) {
    return (
      <div className="rounded-3xl bg-white px-5 py-6 text-center text-stone-500 shadow-sm">
        {mode === "change"
          ? "Fiyatını değiştireceğin ürünün barkodunu okut."
          : mode === "receive"
            ? "Gelen malın barkodunu okut; adet ve yeni alış fiyatını gir."
            : "Barkodu kameraya göster."}
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="rounded-3xl bg-white px-5 py-6 shadow-sm">
        <div className="h-5 w-2/3 animate-pulse rounded bg-stone-200" />
        <div className="mt-3 h-12 w-1/2 animate-pulse rounded bg-stone-200" />
      </div>
    );
  }

  if (state.status !== "found") {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Kayıtlı değil</div>
          <div className="text-sm text-stone-500">{barcode}</div>
        </div>
        <button onClick={onAdd} className="h-12 rounded-2xl bg-emerald-700 px-4 font-semibold text-white active:bg-emerald-800">
          {canEdit ? "Ekle" : "İnternette ara"}
        </button>
      </div>
    );
  }

  const p = state.product;
  const updated = p.updatedAt?.toDate?.() ?? null;
  return (
    <div className="rounded-3xl bg-white px-5 py-4 shadow-sm">
      <div className="text-lg leading-snug font-medium text-stone-700">{p.name}</div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-6xl font-bold tracking-tight text-emerald-700 tabular-nums">{formatTL(p.salePrice)}</div>
        {canEdit && (
          <button
            onClick={onEdit}
            className={`mb-1 h-11 shrink-0 rounded-2xl px-4 font-semibold ${
              mode === "receive" ? "bg-sky-100 text-sky-900 active:bg-sky-200" : "bg-amber-100 text-amber-900 active:bg-amber-200"
            }`}
          >
            {mode === "receive" ? "Mal kabul" : "Değiştir"}
          </button>
        )}
      </div>
      {canEdit && ((p.costPrice && !hideCost) || (showStock && typeof p.stock === "number")) && (
        <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-stone-500">
          {p.costPrice && !hideCost ? <span>Alış {formatTL(p.costPrice)}</span> : null}
          {p.costPrice && !hideCost ? (
            <span className={marginPct(p.salePrice, p.costPrice)! < 0 ? "font-semibold text-red-600" : ""}>
              Kâr {formatPct(marginPct(p.salePrice, p.costPrice)!)}
            </span>
          ) : null}
          {showStock && typeof p.stock === "number" && <span>Stok {p.stock}</span>}
        </div>
      )}
      <div className="mt-1 text-xs text-stone-400">
        {p.barcode}
        {updated && ` · ${timeAgo(updated)} güncellendi`}
        {state.fromCache && !navigator.onLine && " · çevrimdışı"}
      </div>
    </div>
  );
}
