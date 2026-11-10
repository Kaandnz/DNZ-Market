import { useEffect, useState } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import { FieldPad } from "../../ui/FieldPad";
import { MarginLine, PriceChip } from "../../ui/PriceHints";
import { formatPct, formatPlain, formatTL, kurusToInput, parseTL, suggestSale } from "../../lib/money";
import type { Product, StoreSettings } from "../../data/types";

interface Props {
  product: Product | null;
  settings: StoreSettings;
  onClose: () => void;
  onSave: (p: { salePrice: number; costPrice?: number }) => void;
}

/** Fiyat Değiştir: okut → yeni fiyatı yaz → Kaydet. İstenirse alış fiyatı da girilir. */
export function EditPriceSheet({ product, settings, onClose, onSave }: Props) {
  const [sale, setSale] = useState("");
  const [cost, setCost] = useState("");
  const [active, setActive] = useState("sale");

  useEffect(() => {
    setSale("");
    setCost("");
    setActive("sale");
  }, [product?.barcode]);

  if (!product) return null;

  const saleK = sale ? parseTL(sale) : null;
  const costK = cost ? parseTL(cost) : null;
  const finalSale = saleK ?? product.salePrice;
  const finalCost = costK ?? product.costPrice ?? null;
  const changed = (saleK !== null && saleK !== product.salePrice) || (costK !== null && costK !== product.costPrice);
  const valid = (!sale || (saleK !== null && saleK > 0)) && (!cost || costK !== null);
  const canSave = changed && valid;
  const suggestion = finalCost ? suggestSale(finalCost, settings.defaultMarginPct, settings.rounding) : null;

  function save() {
    if (!canSave) return;
    onSave({ salePrice: finalSale, ...(costK !== null ? { costPrice: costK } : {}) });
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={
        <>
          <div className="truncate">{product.name}</div>
          <div className="text-sm font-normal text-stone-500">{product.barcode}</div>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-2xl bg-stone-100 px-4 py-3">
          <span className="text-stone-500">Şu anki fiyat</span>
          <span className="text-2xl font-bold tabular-nums">{formatTL(product.salePrice)}</span>
        </div>

        <FieldPad
          fields={[
            { key: "sale", label: "Yeni satış", value: sale, placeholder: formatPlain(product.salePrice) },
            {
              key: "cost",
              label: "Alış",
              value: cost,
              placeholder: product.costPrice ? formatPlain(product.costPrice) : "—",
              note: product.costPrice ? undefined : "isteğe bağlı",
            },
          ]}
          active={active}
          onActive={setActive}
          onChange={(k, v) => (k === "sale" ? setSale(v) : setCost(v))}
          onEnter={save}
        />

        <MarginLine sale={finalSale} cost={finalCost} />

        {suggestion !== null && suggestion !== finalSale && (
          <PriceChip
            label={`Önerilen (${formatPct(settings.defaultMarginPct)} kâr)`}
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
          {changed ? "Kaydet" : "Fiyat aynı"}
        </button>
      </div>
    </BottomSheet>
  );
}
