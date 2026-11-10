import { formatTL } from "../../lib/money";
import { timeAgo } from "../../lib/useOnline";
import type { PriceChange, PriceSource } from "../../data/types";

export const SOURCE_LABEL: Record<PriceSource, { text: string; cls: string }> = {
  manual: { text: "Elle", cls: "bg-amber-100 text-amber-900" },
  receiving: { text: "Mal kabul", cls: "bg-sky-100 text-sky-900" },
  bulk: { text: "Toplu zam", cls: "bg-violet-100 text-violet-900" },
  new: { text: "Yeni ürün", cls: "bg-emerald-100 text-emerald-900" },
  import: { text: "İçe aktarma", cls: "bg-stone-200 text-stone-800" },
};

/** Fiyat geçmişinde tek satır: ₺12,50 → ₺14,00 ↑, alış değişimi, kim, ne zaman. */
export function ChangeRow({ c, who, showName = true }: { c: PriceChange; who?: string; showName?: boolean }) {
  const src = SOURCE_LABEL[c.source] ?? SOURCE_LABEL.manual;
  const up = c.oldSale !== null && c.newSale > c.oldSale;
  const down = c.oldSale !== null && c.newSale < c.oldSale;
  const costChanged = c.newCost !== null && c.newCost !== c.oldCost;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        {showName && <div className="truncate font-medium text-stone-800">{c.name || c.barcode}</div>}
        <div className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
          {c.oldSale !== null && c.oldSale !== c.newSale && (
            <span className="text-stone-400 line-through">{formatTL(c.oldSale)}</span>
          )}
          <span className={`text-lg font-bold ${up ? "text-red-600" : down ? "text-emerald-700" : "text-stone-800"}`}>
            {formatTL(c.newSale)} {up ? "↑" : down ? "↓" : ""}
          </span>
        </div>
        {costChanged && (
          <div className="text-xs text-stone-500 tabular-nums">
            Alış {c.oldCost !== null ? `${formatTL(c.oldCost)} → ` : ""}
            {formatTL(c.newCost!)}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-stone-500">
        <span className={`rounded-full px-2 py-0.5 font-medium ${src.cls}`}>{src.text}</span>
        <span>{c.at ? timeAgo(c.at) : "gönderiliyor…"}</span>
        {who && <span className="max-w-24 truncate">{who}</span>}
      </div>
    </div>
  );
}
