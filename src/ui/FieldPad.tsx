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

/**
 * Kutudaki rakam sığsın diye yazı boyu: yan yana kutu sayısı arttıkça ve rakam uzadıkça küçülür
 * ("1.250,50 ₺" 4 kutulu satırda da kesilmeden görünür).
 */
function cardTextSize(text: string, columns: number): string {
  // [en fazla karakter, yazı boyu] — 375 px genişlikteki telefonda ölçülerek ayarlandı.
  const steps: [number, string][] =
    columns >= 4
      ? [[4, "text-lg"], [6, "text-sm"], [7, "text-xs"]]
      : columns === 3
        ? [[6, "text-lg"], [8, "text-base"], [10, "text-sm"]]
        : [[9, "text-lg"], [11, "text-base"], [13, "text-sm"]];
  for (const [max, cls] of steps) if (text.length <= max) return cls;
  return "text-[10px]";
}

/** Büyük gösterimdeki rakam telefon ekranına sığsın ("12345,99 ₺" taşmasın). */
function bigTextSize(text: string): string {
  if (text.length <= 6) return "text-6xl";
  if (text.length <= 8) return "text-5xl";
  return "text-4xl";
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
            const text = f.value || f.placeholder || "—";
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onActive(f.key)}
                className={`flex min-w-0 flex-col items-start rounded-2xl py-2 text-left transition ${fields.length >= 4 ? "px-2" : "px-3"} ${
                  on ? "bg-white ring-2 ring-inset ring-emerald-600" : "bg-stone-100 active:bg-stone-200"
                }`}
              >
                <span className={`text-xs font-semibold ${on ? "text-emerald-700" : "text-stone-500"}`}>{f.label}</span>
                <span
                  className={`w-full whitespace-nowrap font-bold tabular-nums ${cardTextSize(text, fields.length)} ${
                    f.value ? "text-stone-900" : f.suggested ? "text-amber-600" : "text-stone-400"
                  }`}
                >
                  {text}
                  <span className="ml-0.5 text-[0.7em] font-medium text-stone-400">{unit(f)}</span>
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
          className={`font-bold tracking-tight ${bigTextSize(current.value || current.placeholder || "0")} ${
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
