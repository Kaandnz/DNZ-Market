import type { ReactNode } from "react";
import { useBackClose } from "../lib/useBackClose";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: Props) {
  useBackClose(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        aria-label="Kapat"
        className="absolute inset-0 bg-black/40 animate-[fade_.15s_ease-out]"
        onClick={onClose}
      />
      <div className="relative mx-auto w-full max-w-lg max-h-[94dvh] overflow-y-auto rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl animate-[up_.2s_ease-out]">
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-white px-5 pt-3 pb-2">
          <div className="min-w-0 flex-1 text-lg font-semibold leading-tight">{title}</div>
          <button
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-stone-100 text-2xl text-stone-500 active:bg-stone-200"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>
        <div className="px-5">{children}</div>
      </div>
    </div>
  );
}
