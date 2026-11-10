import { formatPct, formatTL, marginPct } from "../lib/money";

/** "Kâr %25 · ₺2,50" satırı. Zarar varsa kırmızı. */
export function MarginLine({ sale, cost }: { sale: number | null; cost: number | null | undefined }) {
  if (sale === null || !cost) return null;
  const m = marginPct(sale, cost)!;
  const diff = sale - cost;
  return (
    <div className={`text-center text-sm ${m < 0 ? "font-semibold text-red-600" : "text-stone-500"}`}>
      {m < 0 ? "Zarar" : "Kâr"} {formatPct(Math.abs(m))} · {formatTL(Math.abs(diff))}
    </div>
  );
}

/** "₺12,50 → ₺13,75 · +%10 · +₺1,25" özeti. Fiyat aynıysa hiçbir şey göstermez. */
export function PriceChangeSummary({ oldSale, newSale }: { oldSale: number; newSale: number }) {
  const diff = newSale - oldSale;
  if (diff === 0) return null;
  const pct = oldSale > 0 ? (diff / oldSale) * 100 : 0;
  const sign = diff > 0 ? "+" : "−";
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-center text-base font-semibold tabular-nums ${
        diff > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"
      }`}
    >
      {formatTL(oldSale)} → {formatTL(newSale)} · {sign}
      {formatPct(Math.abs(pct))} · {sign}
      {formatTL(Math.abs(diff))}
    </div>
  );
}

interface ChipProps {
  label: string;
  price: number;
  selected?: boolean;
  onClick: () => void;
}

/** "Önerilen ₺14,50" gibi dokunulabilir fiyat seçeneği. */
export function PriceChip({ label, price, selected, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center rounded-2xl px-3 py-2 ${
        selected ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-800 active:bg-stone-200"
      }`}
    >
      <span className={`text-xs ${selected ? "text-emerald-100" : "text-stone-500"}`}>{label}</span>
      <span className="text-lg font-bold tabular-nums">{formatTL(price)}</span>
    </button>
  );
}
