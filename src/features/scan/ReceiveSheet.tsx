import { useEffect, useState } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import { FieldPad } from "../../ui/FieldPad";
import { MarginLine, PriceChip } from "../../ui/PriceHints";
import { MarginChips } from "../../ui/MarginChips";
import { formatPct, formatPlain, formatTL, marginPct, parseTL, suggestSale } from "../../lib/money";
import type { Product, StoreSettings } from "../../data/types";

export interface ReceiveResult {
  qty: number;
  /** Yeni alış girildiyse. */
  costPrice?: number;
  salePrice: number;
}

interface Props {
  product: Product | null;
  settings: StoreSettings;
  onClose: () => void;
  onSave: (r: ReceiveResult) => void;
}

/**
 * Mal Kabul: mal gelince okut → gelen adet + yeni alış fiyatı.
 * Alış değiştiyse, ürünün mevcut kâr oranını koruyan (yoksa marketin varsayılan kârı)
 * yuvarlanmış satış fiyatı önerilir. "Önerilen" ya da "Eskisi kalsın" seçilir.
 */
export function ReceiveSheet({ product, settings, onClose, onSave }: Props) {
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  /** Kullanıcının yazdığı kâr yüzdesi; boşsa ürünün bugünkü kârı (yoksa varsayılan) kullanılır. */
  const [margin, setMargin] = useState("");
  const [sale, setSale] = useState("");
  /** "suggest": öneri (varsa) kullanılır; "keep": eski satış fiyatı kalır; "typed": elle yazılan. */
  const [saleChoice, setSaleChoice] = useState<"suggest" | "keep" | "typed">("suggest");
  const [active, setActive] = useState("cost");

  useEffect(() => {
    setQty("");
    setCost("");
    setMargin("");
    setSale("");
    setSaleChoice("suggest");
    setActive("cost");
  }, [product?.barcode]);

  if (!product) return null;

  const qtyN = qty ? Number(qty) : 0;
  const costK = cost ? parseTL(cost) : null;
  const oldCost = product.costPrice ?? null;
  const oldSale = product.salePrice;

  // Kâr yüzdesi: yazılan; yoksa ürünün bugünkü kârı; o da yoksa marketin varsayılanı.
  const currentMargin = oldCost ? marginPct(oldSale, oldCost) : null;
  const hasCurrent = currentMargin !== null && currentMargin > 0;
  const defaultMargin = hasCurrent ? currentMargin! : settings.defaultMarginPct;
  const typedMargin = margin !== "" ? Number(margin) : null;
  const usedMargin = typedMargin ?? defaultMargin;
  const marginSource = typedMargin !== null ? "kâr" : hasCurrent ? "bugünkü kâr" : "varsayılan kâr";

  const costChanged = costK !== null && costK !== oldCost;
  const baseCost = costK ?? oldCost;
  // Alış değiştiyse ya da yeni kâr yazıldıysa öner.
  const suggestion = baseCost && (costChanged || typedMargin !== null) ? suggestSale(baseCost, usedMargin, settings.rounding) : null;

  function pickMargin(v: string) {
    setMargin(v);
    setSale("");
    setSaleChoice("suggest");
  }

  const typedSale = sale ? parseTL(sale) : null;
  const finalSale =
    saleChoice === "typed" && typedSale !== null
      ? typedSale
      : saleChoice === "suggest" && suggestion !== null
        ? suggestion
        : oldSale;

  const valid = (!cost || costK !== null) && (saleChoice !== "typed" || (typedSale !== null && typedSale > 0));
  const changed = qtyN > 0 || costChanged || finalSale !== oldSale;
  const canSave = valid && changed;

  function save() {
    if (!canSave) return;
    onSave({ qty: qtyN, ...(costChanged ? { costPrice: costK! } : {}), salePrice: finalSale });
  }

  const salePlaceholder = formatPlain(finalSale);

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={
        <>
          <div className="truncate">{product.name}</div>
          <div className="text-sm font-normal text-stone-500">
            {product.barcode}
            {typeof product.stock === "number" && ` · stok ${product.stock}`}
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FieldPad
          fields={[
            { key: "qty", label: "Adet", value: qty, placeholder: "0", kind: "qty", note: "isteğe bağlı" },
            {
              key: "cost",
              label: "Yeni alış",
              value: cost,
              placeholder: oldCost ? formatPlain(oldCost) : "—",
              note: oldCost ? `eski ${formatPlain(oldCost)}` : "ilk kez",
            },
            {
              key: "margin",
              label: "Kâr",
              value: margin,
              placeholder: String(Math.round(defaultMargin)),
              kind: "pct",
              note: typedMargin !== null ? "senin" : hasCurrent ? "bugünkü" : "varsayılan",
            },
            {
              key: "sale",
              label: "Satış",
              value: saleChoice === "typed" ? sale : "",
              placeholder: salePlaceholder,
              suggested: saleChoice === "suggest" && suggestion !== null && suggestion !== oldSale,
              note: finalSale !== oldSale ? `eski ${formatPlain(oldSale)}` : "aynı",
            },
          ]}
          active={active}
          onActive={setActive}
          onChange={(k, v) => {
            if (k === "qty") setQty(v);
            else if (k === "cost") setCost(v);
            else if (k === "margin") pickMargin(v);
            else {
              setSale(v);
              setSaleChoice(v ? "typed" : "suggest");
            }
          }}
          onEnter={save}
        />

        <MarginChips value={typedMargin} onPick={(m) => pickMargin(String(m))} />

        {baseCost !== null && (costChanged || typedMargin !== null) && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              costChanged && oldCost && costK! < oldCost ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
            }`}
          >
            {costChanged && oldCost ? (
              <>
                Alış {formatTL(oldCost)} → <b>{formatTL(costK!)}</b> ({costK! > oldCost ? "+" : "−"}
                {formatPct(Math.abs(((costK! - oldCost) / oldCost) * 100))}).{" "}
              </>
            ) : (
              <>Alış {formatTL(baseCost)}. </>
            )}
            {suggestion !== null && (
              <>
                {formatPct(usedMargin)} {marginSource}la satış <b>{formatTL(suggestion)}</b> olmalı.
              </>
            )}
          </div>
        )}

        {suggestion !== null && suggestion !== oldSale && (
          <div className="flex gap-2">
            <PriceChip
              label="Önerilen"
              price={suggestion}
              selected={saleChoice === "suggest"}
              onClick={() => {
                setSale("");
                setSaleChoice("suggest");
              }}
            />
            <PriceChip
              label="Eskisi kalsın"
              price={oldSale}
              selected={saleChoice === "keep"}
              onClick={() => {
                setSale("");
                setSaleChoice("keep");
              }}
            />
          </div>
        )}

        <MarginLine sale={finalSale} cost={costK ?? oldCost} />

        <button
          onClick={save}
          disabled={!canSave}
          className="h-16 rounded-2xl bg-sky-700 text-xl font-bold text-white active:bg-sky-800 disabled:bg-stone-300"
        >
          {!changed
            ? "Adet ya da alış gir"
            : `Kaydet${qtyN > 0 ? ` · +${qtyN} adet` : ""}${finalSale !== oldSale ? ` · ${formatTL(finalSale)}` : ""}`}
        </button>
      </div>
    </BottomSheet>
  );
}
