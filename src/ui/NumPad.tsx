import { useEffect } from "react";
import { applyKey, applyQtyKey } from "../lib/money";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  /** Fiziksel klavyeden yazmayı dinle (bilgisayar için). */
  listenKeyboard?: boolean;
  /** false: adet girişi (virgül yok). */
  decimal?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"];

/**
 * Büyük tuşlu fiyat tuş takımı. Telefon klavyesi açılmasını beklemeden
 * okutur okutmaz fiyat yazılabilsin diye kendi tuş takımımızı kullanıyoruz.
 */
export function NumPad({ value, onChange, onEnter, listenKeyboard = true, decimal = true }: Props) {
  const apply = decimal ? applyKey : applyQtyKey;
  useEffect(() => {
    if (!listenKeyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      let key: string | null = null;
      if (/^\d$/.test(e.key)) key = e.key;
      else if (e.key === "," || e.key === ".") key = ",";
      else if (e.key === "Backspace") key = "back";
      else if (e.key === "Escape") return;
      else if (e.key === "Enter") {
        e.preventDefault();
        onEnter?.();
        return;
      }
      if (key) {
        e.preventDefault();
        onChange(apply(value, key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange, onEnter, listenKeyboard, apply]);

  return (
    <div className="grid grid-cols-3 gap-2 select-none">
      {KEYS.map((k) =>
        k === "," && !decimal ? (
          <div key={k} />
        ) : (
        <button
          key={k}
          type="button"
          onClick={() => onChange(apply(value, k))}
          onContextMenu={(e) => {
            if (k === "back") {
              e.preventDefault();
              onChange("");
            }
          }}
          className="h-14 rounded-2xl bg-stone-100 text-2xl font-semibold text-stone-800 active:scale-95 active:bg-stone-200 transition"
          aria-label={k === "back" ? "Sil" : k}
        >
          {k === "back" ? "⌫" : k}
        </button>
        ),
      )}
    </div>
  );
}

/** Tuş takımının yazdığı metni ekranda "12,50" gibi gösterir. */
export function PriceDisplay({ value, placeholder }: { value: string; placeholder?: string }) {
  return (
    <div className="flex items-baseline justify-center gap-2 py-2 tabular-nums">
      <span className={`text-6xl font-bold tracking-tight ${value ? "text-stone-900" : "text-stone-300"}`}>
        {value || placeholder || "0"}
      </span>
      <span className="text-3xl font-semibold text-stone-400">₺</span>
    </div>
  );
}
