import { useId } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Daha önce kullanılanlar (ör. mevcut kategoriler); yazarken öneri olarak çıkar. */
  suggestions: string[];
  placeholder?: string;
}

/** Serbest metin + daha önce yazılanlardan öneri (kategori, marka). */
export function SuggestInput({ label, value, onChange, suggestions, placeholder }: Props) {
  const id = useId();
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-600">{label}</label>
      <input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={100}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-stone-300 px-4 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
      />
      <datalist id={id}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}

/** Ürünlerden benzersiz kategori / marka listesi (Türkçe sıralı). */
export function uniqueValues(values: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const t = v?.trim();
    if (t && !seen.has(t.toLocaleLowerCase("tr-TR"))) seen.set(t.toLocaleLowerCase("tr-TR"), t);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "tr-TR"));
}
