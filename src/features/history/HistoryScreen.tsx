import { useEffect, useMemo, useState } from "react";
import { useActiveStore } from "../store/StoreProvider";
import { watchHistory } from "../../data/products";
import { watchMembers } from "../../data/stores";
import { errorText } from "../../lib/events";
import { ChangeRow, SOURCE_LABEL } from "./ChangeRow";
import type { PriceChange, PriceSource } from "../../data/types";

const PAGE = 50;

function dayLabel(d: Date | null): string {
  if (!d) return "Bugün";
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Bugün";
  if (same(d, y)) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
}

/** Fiyat geçmişi: kim, ne zaman, hangi fiyattan hangisine. Güne göre gruplu. */
export function HistoryScreen() {
  const { store } = useActiveStore();
  const [max, setMax] = useState(PAGE);
  const [items, setItems] = useState<PriceChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<PriceSource | "all">("all");

  useEffect(
    () =>
      watchHistory(
        store.id,
        max,
        (list, fromCache) => {
          setItems(list);
          if (!fromCache || list.length > 0) setLoading(false);
        },
        (e) => {
          setError(errorText(e));
          setLoading(false);
        },
      ),
    [store.id, max],
  );

  useEffect(
    () => watchMembers(store.id, (list) => setNames(Object.fromEntries(list.map((m) => [m.uid, m.displayName]))), () => {}),
    [store.id],
  );

  const groups = useMemo(() => {
    const shown = filter === "all" ? items : items.filter((c) => c.source === filter);
    const out: { day: string; list: PriceChange[] }[] = [];
    for (const c of shown) {
      const day = dayLabel(c.at);
      if (out.at(-1)?.day !== day) out.push({ day, list: [] });
      out.at(-1)!.list.push(c);
    }
    return out;
  }, [items, filter]);

  const multiUser = Object.keys(names).length > 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(["all", "manual", "receiving", "new", "bulk"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold ${
              filter === f ? "bg-stone-800 text-white" : "bg-white text-stone-600 shadow-sm"
            }`}
          >
            {f === "all" ? "Hepsi" : SOURCE_LABEL[f].text}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</p>}
      {loading && <div className="py-8 text-center text-stone-400">Yükleniyor…</div>}
      {!loading && groups.length === 0 && (
        <div className="rounded-3xl bg-white px-5 py-8 text-center text-stone-500 shadow-sm">Henüz fiyat değişikliği yok.</div>
      )}

      {groups.map((g) => (
        <section key={g.day}>
          <h3 className="px-1 pb-1 text-sm font-semibold text-stone-500">{g.day}</h3>
          <div className="divide-y divide-stone-100 rounded-3xl bg-white px-4 shadow-sm">
            {g.list.map((c) => (
              <ChangeRow key={c.id} c={c} who={multiUser ? names[c.uid] : undefined} />
            ))}
          </div>
        </section>
      ))}

      {items.length >= max && (
        <button onClick={() => setMax((m) => m + PAGE)} className="py-3 font-medium text-emerald-700">
          Daha eski değişiklikleri göster
        </button>
      )}
    </div>
  );
}
