import { useState } from "react";
import { cartCount, cartTotal, type Cart } from "../../lib/cart";
import { formatTL } from "../../lib/money";

interface Props {
  cart: Cart;
  /** Satış bitince stoktan düşülebilir mi (fiyat değiştirme yetkisi olan)? */
  canEdit: boolean;
  onQty: (barcode: string, qty: number) => void;
  onClear: () => void;
  onFinish: () => void;
}

/** Satış modu: okutulan ürünler listesi ve büyük toplam. */
export function SalePanel({ cart, canEdit, onQty, onClear, onFinish }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const total = cartTotal(cart);
  const count = cartCount(cart);

  if (cart.items.length === 0) {
    return (
      <div className="rounded-3xl bg-white px-5 py-6 text-center shadow-sm">
        <div className="text-5xl font-bold text-stone-300 tabular-nums">{formatTL(0)}</div>
        <p className="mt-2 text-stone-500">Satılan ürünleri okut, toplam burada çıkar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between rounded-3xl bg-emerald-700 px-5 py-4 text-white shadow-sm">
        <div>
          <div className="text-sm text-emerald-100">Toplam · {count} ürün</div>
          <div className="text-5xl font-bold tracking-tight tabular-nums">{formatTL(total)}</div>
        </div>
      </div>

      <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white shadow-sm">
        {cart.items.map((i) => (
          <li key={i.barcode} className={`flex items-center gap-2 px-3 py-2 ${cart.last === i.barcode ? "bg-emerald-50" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-stone-800">{i.name}</div>
              <div className="text-xs text-stone-500 tabular-nums">
                {i.qty} × {formatTL(i.price)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => onQty(i.barcode, i.qty - 1)}
                className="grid size-10 place-items-center rounded-xl bg-stone-100 text-xl font-bold active:bg-stone-200"
                aria-label={i.qty === 1 ? "Çıkar" : "Azalt"}
              >
                {i.qty === 1 ? "×" : "−"}
              </button>
              <span className="w-7 text-center text-lg font-bold tabular-nums">{i.qty}</span>
              <button
                onClick={() => onQty(i.barcode, i.qty + 1)}
                className="grid size-10 place-items-center rounded-xl bg-stone-100 text-xl font-bold active:bg-stone-200"
                aria-label="Artır"
              >
                +
              </button>
            </div>
            <div className="w-20 shrink-0 text-right font-bold tabular-nums">{formatTL(i.price * i.qty)}</div>
          </li>
        ))}
      </ul>

      {confirmClear ? (
        <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
          <span className="flex-1 self-center text-sm font-medium text-red-800">Liste silinsin mi? (stok değişmez)</span>
          <button onClick={() => setConfirmClear(false)} className="h-11 rounded-xl bg-white px-4 font-semibold">
            Vazgeç
          </button>
          <button
            onClick={() => {
              onClear();
              setConfirmClear(false);
            }}
            className="h-11 rounded-xl bg-red-600 px-4 font-semibold text-white"
          >
            Sil
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setConfirmClear(true)} className="h-14 rounded-2xl bg-stone-200 px-4 font-semibold text-stone-700 active:bg-stone-300">
            Temizle
          </button>
          <button onClick={onFinish} className="h-14 flex-1 rounded-2xl bg-emerald-700 text-lg font-bold text-white active:bg-emerald-800">
            ✓ Satışı bitir
          </button>
        </div>
      )}
      {canEdit && cart.items.some((i) => i.tracked) && (
        <p className="text-center text-xs text-stone-400">Bitirince stoğu tutulan ürünler stoktan düşer.</p>
      )}
    </div>
  );
}
