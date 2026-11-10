import { useEffect, useState } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import { FieldPad } from "../../ui/FieldPad";
import { MarginLine, PriceChip } from "../../ui/PriceHints";
import { SuggestInput } from "../../ui/SuggestInput";
import { MicButton } from "../../ui/MicButton";
import { formatPct, kurusToInput, parseTL, suggestSale } from "../../lib/money";
import { normalizeBarcode } from "../../lib/barcode";
import { internalCode, savePrice } from "../../data/products";
import { beepSaved } from "../../lib/feedback";
import { toast } from "../../lib/events";
import type { Product, StoreSettings } from "../../data/types";
import { useHideCost } from "../../lib/prefs";

interface Props {
  open: boolean;
  storeId: string;
  uid: string;
  settings: StoreSettings;
  products: Product[];
  categories: string[];
  onClose: () => void;
}

/**
 * Listeden elle ürün ekleme. Barkodu olmayan ürünler (dökme şeker, ekmek, poşet…) için
 * barkod boş bırakılır; uygulama kısa bir iç kod verir.
 */
export function AddProductSheet({ open, storeId, uid, settings, products, categories, onClose }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [sale, setSale] = useState("");
  const [cost, setCost] = useState("");
  const [active, setActive] = useState("sale");
  const hideCost = useHideCost();

  useEffect(() => {
    if (!open) return;
    setName("");
    setCode("");
    setCategory("");
    setSale("");
    setCost("");
    setActive("sale");
  }, [open]);

  if (!open) return null;

  const saleK = sale ? parseTL(sale) : null;
  const costK = cost ? parseTL(cost) : null;
  const typedCode = code.trim() ? normalizeBarcode(code) : null;
  const codeInvalid = code.trim() !== "" && !typedCode;
  const duplicate = typedCode ? products.find((p) => p.barcode === typedCode) : undefined;
  const suggestion = costK ? suggestSale(costK, settings.defaultMarginPct, settings.rounding) : null;
  const canSave = name.trim().length > 0 && saleK !== null && saleK > 0 && (!cost || costK !== null) && !codeInvalid && !duplicate;

  function save() {
    if (!canSave || saleK === null) return;
    savePrice({
      storeId,
      uid,
      barcode: typedCode ?? internalCode(),
      existing: null,
      name: name.trim(),
      salePrice: saleK,
      ...(costK !== null ? { costPrice: costK } : {}),
      category,
      source: "new",
    });
    beepSaved();
    toast("Ürün eklendi.");
    onClose();
  }

  return (
    <BottomSheet open onClose={onClose} title="Ürün ekle">
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">Ürün adı</label>
          <div className="relative">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="ör. Toz şeker (kg)"
              className="h-14 w-full rounded-2xl border border-stone-300 pr-12 pl-4 text-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />
            <MicButton onText={setName} className="absolute top-1/2 right-2 -translate-y-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Barkod</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="yoksa boş bırak"
              className={`h-12 w-full rounded-2xl border px-4 text-base outline-none focus:ring-2 ${
                codeInvalid || duplicate ? "border-red-400 focus:ring-red-400/20" : "border-stone-300 focus:border-emerald-600 focus:ring-emerald-600/20"
              }`}
            />
          </div>
          <SuggestInput label="Kategori" value={category} onChange={setCategory} suggestions={categories} placeholder="isteğe bağlı" />
        </div>
        {duplicate && <p className="-mt-1 text-sm text-red-600">Bu barkod zaten kayıtlı: {duplicate.name}</p>}
        {codeInvalid && <p className="-mt-1 text-sm text-red-600">Barkod sadece rakam ve harf olabilir.</p>}

        <FieldPad
          fields={[
            { key: "sale", label: "Satış", value: sale, placeholder: "0" },
            { key: "cost", label: "Alış", value: cost, placeholder: "—", note: "isteğe bağlı" },
          ].filter((f) => !(hideCost && f.key === "cost"))}
          active={active}
          onActive={setActive}
          onChange={(k, v) => (k === "sale" ? setSale(v) : setCost(v))}
          onEnter={save}
        />
        {!hideCost && <MarginLine sale={saleK} cost={costK} />}
        {!hideCost && suggestion !== null && suggestion !== saleK && (
          <PriceChip
            label={`Önerilen satış (${formatPct(settings.defaultMarginPct)} kâr)`}
            price={suggestion}
            onClick={() => {
              setSale(kurusToInput(suggestion));
              setActive("sale");
            }}
          />
        )}

        <button
          onClick={save}
          disabled={!canSave}
          className="h-16 rounded-2xl bg-emerald-700 text-xl font-bold text-white active:bg-emerald-800 disabled:bg-stone-300"
        >
          {!name.trim() ? "Önce ürün adını yaz" : "Ürünü kaydet"}
        </button>
      </div>
    </BottomSheet>
  );
}
