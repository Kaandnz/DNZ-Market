const MARGINS = [10, 15, 20, 25, 30, 40];

/** Hızlı kâr yüzdesi seçimi: %10 · %15 · %20 · %25 · %30 · %40 */
export function MarginChips({ value, onPick }: { value: number | null; onPick: (m: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm font-medium text-stone-600">Kâr:</span>
      {MARGINS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onPick(m)}
          className={`h-9 rounded-full px-3 text-sm font-semibold ${
            value === m ? "bg-sky-700 text-white" : "bg-stone-100 text-stone-700 active:bg-stone-200"
          }`}
        >
          %{m}
        </button>
      ))}
    </div>
  );
}
