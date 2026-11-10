const MARGINS = [10, 15, 20, 25, 30, 40];
const RAISES = [5, 10, 15, 20, 25];

interface PctChipsProps {
  label: string;
  values: number[];
  value: number | null;
  onPick: (v: number) => void;
  prefix?: string;
}

/** Hızlı yüzde seçimi (ör. "Kâr: %10 %15 …" ya da "Zam: +%5 +%10 …"). */
export function PctChips({ label, values, value, onPick, prefix = "%" }: PctChipsProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-10 shrink-0 text-sm font-medium text-stone-600">{label}</span>
      {values.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onPick(m)}
          className={`h-9 min-w-0 flex-1 rounded-full px-0 text-sm font-semibold whitespace-nowrap ${
            value === m ? "bg-sky-700 text-white" : "bg-stone-100 text-stone-700 active:bg-stone-200"
          }`}
        >
          {prefix}
          {m}
        </button>
      ))}
    </div>
  );
}

/** Hızlı kâr yüzdesi seçimi: %10 · %15 · %20 · %25 · %30 · %40 */
export function MarginChips({ value, onPick }: { value: number | null; onPick: (m: number) => void }) {
  return <PctChips label="Kâr:" values={MARGINS} value={value} onPick={onPick} />;
}

/** Hızlı zam seçimi (şu anki satış fiyatına): +%5 · +%10 · +%15 · +%20 · +%25 */
export function RaiseChips({ value, onPick }: { value: number | null; onPick: (m: number) => void }) {
  return <PctChips label="Zam:" values={RAISES} value={value} onPick={onPick} prefix="+%" />;
}
