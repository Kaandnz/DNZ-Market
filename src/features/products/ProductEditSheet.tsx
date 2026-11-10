import { useEffect, useState } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import { FieldPad } from "../../ui/FieldPad";
import { MarginLine } from "../../ui/PriceHints";
import { formatPlain, formatTL, parseTL } from "../../lib/money";
import { deleteProduct, savePrice, watchProductHistory } from "../../data/products";
import { beepSaved } from "../../lib/feedback";
import { toast } from "../../lib/events";
import { ChangeRow } from "../history/ChangeRow";
import { SuggestInput } from "../../ui/SuggestInput";
import { useHideCost } from "../../lib/prefs";
import type { PriceChange, Product } from "../../data/types";

interface Props {
  product: Product | null;
  storeId: string;
  uid: string;
  canEdit: boolean;
  /** Mevcut kategoriler ve markalar (öneri için). */
  categories?: string[];
  brands?: string[];
  onClose: () => void;
}

/** Listeden bir ürüne dokununca: adı, kategorisi, satış ve alış fiyatını düzelt, geçmişini gör ya da sil. */
export function ProductEditSheet({ product, storeId, uid, canEdit, categories = [], brands = [], onClose }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [sale, setSale] = useState("");
  const [cost, setCost] = useState("");
  const [active, setActive] = useState("sale");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState<PriceChange[]>([]);
  const hideCost = useHideCost();

  useEffect(() => {
    setName(product?.name ?? "");
    setCategory(product?.category ?? "");
    setBrand(product?.brand ?? "");
    setSale("");
    setCost("");
    setActive("sale");
    setConfirmDelete(false);
    setHistory([]);
    if (!product || !canEdit) return;
    return watchProductHistory(storeId, product.barcode, setHistory);
  }, [product?.barcode, storeId, canEdit]);

  if (!product) return null;

  const saleK = sale ? parseTL(sale) : product.salePrice;
  const costK = cost ? parseTL(cost) : null;
  const trimmed = name.trim();
  const metaChanged = category.trim() !== (product.category ?? "") || brand.trim() !== (product.brand ?? "");
  const changed =
    trimmed !== product.name ||
    metaChanged ||
    (saleK !== null && saleK !== product.salePrice) ||
    (costK !== null && costK !== product.costPrice);
  const canSave = canEdit && trimmed.length > 0 && saleK !== null && saleK > 0 && (!cost || costK !== null) && changed;

  function save() {
    if (!product || !canSave || saleK === null) return;
    savePrice({
      storeId,
      uid,
      barcode: product.barcode,
      existing: product,
      name: trimmed,
      salePrice: saleK,
      ...(costK !== null ? { costPrice: costK } : {}),
      category,
      brand,
      source: "manual",
    });
    beepSaved();
    toast("Kaydedildi.");
    onClose();
  }

  function remove() {
    if (!product) return;
    deleteProduct(storeId, uid, product.barcode);
    toast(`${product.name} silindi.`, "info");
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={
        <>
          <div>{canEdit ? "Ürünü düzenle" : product.name}</div>
          <div className="text-sm font-normal text-stone-500">
            {product.barcode}
            {canEdit && typeof product.stock === "number" && ` · stok ${product.stock}`}
          </div>
        </>
      }
    >
      {!canEdit ? (
        <div className="pb-4 text-center text-5xl font-bold text-emerald-700 tabular-nums">{formatTL(product.salePrice)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Ürün adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              className="h-14 w-full rounded-2xl border border-stone-300 px-4 text-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SuggestInput label="Kategori" value={category} onChange={setCategory} suggestions={categories} placeholder="ör. İçecek" />
            <SuggestInput label="Marka" value={brand} onChange={setBrand} suggestions={brands} placeholder="ör. Ülker" />
          </div>

          <FieldPad
            fields={[
              { key: "sale", label: "Satış", value: sale, placeholder: formatPlain(product.salePrice) },
              { key: "cost", label: "Alış", value: cost, placeholder: product.costPrice ? formatPlain(product.costPrice) : "—" },
            ].filter((f) => !(hideCost && f.key === "cost"))}
            active={active}
            onActive={setActive}
            onChange={(k, v) => (k === "sale" ? setSale(v) : setCost(v))}
            onEnter={save}
          />
          {!hideCost && <MarginLine sale={saleK} cost={costK ?? product.costPrice} />}

          <button
            onClick={save}
            disabled={!canSave}
            className="h-16 rounded-2xl bg-emerald-700 text-xl font-bold text-white active:bg-emerald-800 disabled:bg-stone-300"
          >
            {changed ? "Kaydet" : "Değişiklik yok"}
          </button>

          {history.length > 0 && (
            <div className="rounded-2xl bg-stone-50 px-3">
              <div className="pt-3 text-xs font-medium tracking-wide text-stone-400 uppercase">Son değişiklikler</div>
              <div className="divide-y divide-stone-200">
                {history.map((c) => (
                  <ChangeRow key={c.id} c={c} showName={false} />
                ))}
              </div>
            </div>
          )}

          {confirmDelete ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="mb-3 font-medium text-red-800">"{product.name}" listeden silinsin mi?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="h-12 flex-1 rounded-xl bg-white font-semibold">
                  Vazgeç
                </button>
                <button onClick={remove} className="h-12 flex-1 rounded-xl bg-red-600 font-semibold text-white">
                  Sil
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="py-2 text-sm font-medium text-red-600">
              Ürünü sil
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
