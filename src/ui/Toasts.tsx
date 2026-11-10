import { useEffect, useState } from "react";
import { onToast, type ToastMsg } from "../lib/events";

export function Toasts() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        setItems((list) => [...list.slice(-2), t]);
        setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), t.kind === "error" ? 5000 : 2200);
      }),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={`max-w-md rounded-2xl px-4 py-3 text-center text-base font-medium shadow-lg animate-[fade_.15s_ease-out] ${
            t.kind === "error"
              ? "bg-red-600 text-white"
              : t.kind === "info"
                ? "bg-stone-800 text-white"
                : "bg-emerald-600 text-white"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
