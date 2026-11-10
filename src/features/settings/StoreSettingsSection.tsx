import { useActiveStore } from "../store/StoreProvider";
import { updateStoreSettings } from "../../data/stores";
import { ROUNDING_OPTIONS, formatTL, suggestSale } from "../../lib/money";
import { errorText, toast } from "../../lib/events";
import type { StoreSettings } from "../../data/types";

const MARGINS = [10, 15, 20, 25, 30, 40];

/** Sahip için: varsayılan kâr yüzdesi ve fiyat yuvarlama. Tüm cihazlarda geçerli. */
export function StoreSettingsSection() {
  const { store, isOwner } = useActiveStore();
  if (!isOwner) return null;
  const s = store.settings;

  function set(patch: Partial<StoreSettings>) {
    updateStoreSettings(store.id, patch).catch((e) => toast(errorText(e), "error"));
  }

  const margin = s.defaultMarginPct;
  const example = suggestSale(1000, margin, s.rounding);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h3 className="font-semibold">Market ayarları</h3>
      <p className="mb-3 text-xs text-stone-500">Mal kabulde ve önerilen fiyatlarda kullanılır. Bütün cihazlarda geçerlidir.</p>

      <div className="mb-1 text-sm font-medium text-stone-600">Varsayılan kâr</div>
      <div className="mb-1 flex items-center gap-2">
        <button
          onClick={() => set({ defaultMarginPct: Math.max(0, margin - 1) })}
          className="grid size-11 place-items-center rounded-xl bg-stone-100 text-xl font-bold active:bg-stone-200"
          aria-label="Azalt"
        >
          −
        </button>
        <div className="w-16 text-center text-2xl font-bold tabular-nums">%{margin}</div>
        <button
          onClick={() => set({ defaultMarginPct: Math.min(500, margin + 1) })}
          className="grid size-11 place-items-center rounded-xl bg-stone-100 text-xl font-bold active:bg-stone-200"
          aria-label="Artır"
        >
          +
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {MARGINS.map((m) => (
          <button
            key={m}
            onClick={() => set({ defaultMarginPct: m })}
            className={`h-9 rounded-full px-3 text-sm font-semibold ${m === margin ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-700"}`}
          >
            %{m}
          </button>
        ))}
      </div>

      <div className="mb-1 text-sm font-medium text-stone-600">Önerilen fiyatı yuvarla</div>
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-stone-100 p-1">
        {ROUNDING_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => set({ rounding: o.value })}
            className={`h-10 rounded-lg text-sm font-semibold ${s.rounding === o.value ? "bg-white shadow" : "text-stone-600"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Örnek: alış {formatTL(1000)} → önerilen satış <b>{formatTL(example)}</b>
      </p>
    </section>
  );
}
