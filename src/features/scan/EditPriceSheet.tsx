import { useEffect, useState } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import { FieldPad } from "../../ui/FieldPad";
import { MarginLine } from "../../ui/PriceHints";
import { MarginChips, RaiseChips } from "../../ui/MarginChips";
import { formatPct, formatPlain, formatTL, kurusToInput, parseTL, roundPrice, suggestSale } from "../../lib/money";
import type { Product, StoreSettings } from "../../data/types";

interface Props {
  product: Product | null;
  settings: StoreSettings;
  /** Alış / kâr bu telefonda gizli */
  hideCost?: boolean;
  onClose: () => void;
  onSave: (p: { salePrice: number; costPrice?: number }) => void;
}

/**
 * Fiyat Değiştir: okut → yeni fiyatı yaz (ya da "Zam %" / "Kâr %" düğmesine bas) → Kaydet.
 * Eski → yeni fiyat farkı (% ve ₺) ve anlık kâr gösterilir. İstenirse alış da girilir.
 */
export function EditPriceSheet({ product, settings, hideCost = false, onClose, onSave }: Props) {
  const [sale, setSale] = useState("");
  const [cost, setCost] = useState("");
  const [active, setActive] = useState("sale");
  /** Hangi hızlı düğmeyle hesaplandı (vurgulamak için) */
  const [picked, setPicked] = useState<{ kind: "raise" | "margin"; pct: number } | null>(null);

  useEffect(() => {
    setSale("");
    setCost("");
    setActive("sale");
    setPicked(null);
  }, [product?.barcode]);

  if (!product) return null;

  const oldSale = product.salePrice;
  const saleK = sale ? parseTL(sale) : null;
  const costK = cost ? parseTL(cost) : null;
  const finalSale = saleK ?? oldSale;
  const finalCost = costK ?? product.costPrice ?? null;
  const changed = (saleK !== null && saleK !== oldSale) || (costK !== null && costK !== product.costPrice);
  const valid = (!sale || (saleK !== null && saleK > 0)) && (!cost || costK !== null);
  const canSave = changed && valid;
  const showCost = !hideCost;

  function setPrice(kurus: number, pick: typeof picked) {
    setSale(kurusToInput(kurus));
    setPicked(pick);
    setActive("sale");
  }

  function save() {
    if (!canSave) return;
    onSave({ salePrice: finalSale, ...(costK !== null ? { costPrice: costK } : {}) });
  }

  const diff = finalSale - oldSale;
  const diffPct = oldSale > 0 ? (diff / oldSale) * 100 : 0;

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
          <span className="text-2xl font-bold tabular-nums">{formatTL(oldSale)}</span>
        </div>

        <FieldPad
          fields={[
            { key: "sale", label: "Yeni satış", value: sale, placeholder: formatPlain(oldSale) },
            {
              key: "cost",
              label: "Alış",
              value: cost,
              placeholder: product.costPrice ? formatPlain(product.costPrice) : "—",
              note: product.costPrice ? undefined : "isteğe bağlı",
            },
          ].filter((f) => showCost || f.key !== "cost")}
          active={active}
          onActive={setActive}
          onChange={(k, v) => {
            if (k === "sale") {
              setSale(v);
              setPicked(null);
            } else setCost(v);
          }}
          onEnter={save}
        />

        {/* Ne kadar arttı / azaldı */}
        {diff !== 0 && (
          <div
            className={`rounded-2xl px-4 py-3 text-center text-base font-semibold tabular-nums ${
              diff > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"
            }`}
          >
            {formatTL(oldSale)} → {formatTL(finalSale)} · {diff > 0 ? "+" : "−"}
            {formatPct(Math.abs(diffPct))} · {diff > 0 ? "+" : "−"}
            {formatTL(Math.abs(diff))}
          </div>
        )}

        <RaiseChips
          value={picked?.kind === "raise" ? picked.pct : null}
          onPick={(p) => setPrice(roundPrice(oldSale * (1 + p / 100), settings.rounding), { kind: "raise", pct: p })}
        />
        {showCost && finalCost ? (
          <MarginChips
            value={picked?.kind === "margin" ? picked.pct : null}
            onPick={(m) => setPrice(suggestSale(finalCost, m, settings.rounding), { kind: "margin", pct: m })}
          />
        ) : null}

        {showCost && <MarginLine sale={finalSale} cost={finalCost} />}

        <button
          onClick={save}
          disabled={!canSave}
          className="h-16 rounded-2xl bg-emerald-700 text-xl font-bold text-white active:bg-emerald-800 disabled:bg-stone-300"
        >
          {changed ? `Kaydet · ${formatTL(finalSale)}` : "Fiyat aynı"}
        </button>
      </div>
    </BottomSheet>
  );
}
