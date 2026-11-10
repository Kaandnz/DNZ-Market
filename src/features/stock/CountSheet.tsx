import { useEffect, useState } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import { FieldPad } from "../../ui/FieldPad";
import { DEFAULT_MIN_STOCK, setStockCount } from "../../data/products";
import { beepSaved } from "../../lib/feedback";
import { toast } from "../../lib/events";
import type { Product } from "../../data/types";

interface Props {
  product: Product | null;
  storeId: string;
  uid: string;
  onClose: () => void;
}

/** Sayım: raftaki gerçek adet yazılır, stok ona eşitlenir. Azalınca uyarı sınırı da buradan. */
export function CountSheet({ product, storeId, uid, onClose }: Props) {
  const [count, setCount] = useState("");
  const [min, setMin] = useState("");
  const [active, setActive] = useState("count");

  useEffect(() => {
    setCount("");
    setMin("");
    setActive("count");
  }, [product?.barcode]);

  if (!product) return null;

  const current = product.stock;
  const countN = count ? Number(count) : null;
  const minN = min ? Number(min) : null;
  const changed = (countN !== null && countN !== current) || (minN !== null && minN !== product.minStock);
  // Hiç sayılmamış üründe sadece uyarı sınırı yazılırsa stok 0 sanılmasın: önce adet gerekir.
  const canSave = changed && (countN !== null || current !== undefined);

  function save() {
    if (!product || !canSave) return;
    setStockCount(storeId, uid, product, countN ?? current ?? 0, minN ?? undefined);
    beepSaved();
    if (countN !== null && current !== undefined && countN !== current) {
      const d = countN - current;
      toast(`Stok ${countN} oldu (${d > 0 ? "+" : ""}${d}).`);
    } else toast("Kaydedildi.");
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={
        <>
          <div className="truncate">{product.name}</div>
          <div className="text-sm font-normal text-stone-500">
            {product.barcode} · şu an {current ?? "—"} adet
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FieldPad
          fields={[
            { key: "count", label: "Raftaki adet", value: count, placeholder: current !== undefined ? String(current) : "0", kind: "qty" },
            {
              key: "min",
              label: "Uyarı sınırı",
              value: min,
              placeholder: String(product.minStock ?? DEFAULT_MIN_STOCK),
              kind: "qty",
              note: "bu sayıya inince uyar",
            },
          ]}
          active={active}
          onActive={setActive}
          onChange={(k, v) => (k === "count" ? setCount(v) : setMin(v))}
          onEnter={save}
        />
        <button
          onClick={save}
          disabled={!canSave}
          className="h-16 rounded-2xl bg-emerald-700 text-xl font-bold text-white active:bg-emerald-800 disabled:bg-stone-300"
        >
          {canSave ? "Kaydet" : "Adet yaz"}
        </button>
      </div>
    </BottomSheet>
  );
}
