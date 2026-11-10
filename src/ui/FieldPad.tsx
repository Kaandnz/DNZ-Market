import type { ReactNode } from "react";
import { NumPad } from "./NumPad";

export interface PadField {
  key: string;
  label: string;
  /** Tuş takımıyla yazılan metin ("12,5" ya da "24"). */
  value: string;
  /** Boşken gri gösterilen değer (ör. şu anki fiyat). */
  placeholder?: string;
  kind?: "money" | "qty" | "pct";
  /** Kutunun altındaki küçük not. */
  note?: ReactNode;
  /** Boşken gösterilen değer "öneri" mi? (vurgulu gösterilir) */
  suggested?: boolean;
}

interface Props {
  fields: PadField[];
  active: string;
  onActive: (key: string) => void;
  onChange: (key: string, value: string) => void;
  onEnter?: () => void;
}

/**
 * Birden çok sayı kutusu (ör. Adet / Alış / Satış) + tek tuş takımı.
 * Dokunulan kutu seçilir, tuş takımı onu doldurur; seçili kutu büyük gösterilir.
 */
export function FieldPad({ fields, active, onActive, onChange, onEnter }: Props) {
  const current = fields.find((f) => f.key === active) ?? fields[0];
  const unit = (f: PadField) => (f.kind === "qty" ? "adet" : f.kind === "pct" ? "%" : "₺");

  return (
    <div className="flex flex-col gap-3">
      {fields.length > 1 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))` }}>
          {fields.map((f) => {
            const on = f.key === current.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onActive(f.key)}
                className={`flex min-w-0 flex-col items-start rounded-2xl px-3 py-2 text-left transition ${
                  on ? "bg-white ring-2 ring-emerald-600" : "bg-stone-100 active:bg-stone-200"
                }`}
              >
                <span className={`text-xs font-semibold ${on ? "text-emerald-700" : "text-stone-500"}`}>{f.label}</span>
                <span
                  className={`w-full truncate text-lg font-bold tabular-nums ${
                    f.value ? "text-stone-900" : f.suggested ? "text-amber-600" : "text-stone-400"
                  }`}
                >
                  {f.value || f.placeholder || "—"} <span className="text-sm font-medium text-stone-400">{unit(f)}</span>
                </span>
                {f.note && <span className="w-full truncate text-[11px] text-stone-500">{f.note}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-baseline justify-center gap-2 py-1 tabular-nums">
        {fields.length > 1 && <span className="text-sm font-medium text-stone-400">{current.label}</span>}
        <span
          className={`text-6xl font-bold tracking-tight ${
            current.value ? "text-stone-900" : current.suggested ? "text-amber-500" : "text-stone-300"
          }`}
        >
          {current.value || current.placeholder || "0"}
        </span>
        <span className="text-3xl font-semibold text-stone-400">{unit(current)}</span>
      </div>

      <NumPad
        value={current.value}
        onChange={(v) => onChange(current.key, v)}
        onEnter={onEnter}
        decimal={current.kind !== "qty" && current.kind !== "pct"}
      />
    </div>
  );
}
