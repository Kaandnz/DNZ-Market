/** Satış modu sepeti (Firebase'siz, test edilebilir). Fiyatlar kuruş. */

export interface CartItem {
  barcode: string;
  name: string;
  /** Okutulduğu andaki satış fiyatı */
  price: number;
  qty: number;
  /** Ürünün stoğu tutuluyor mu? (Satış bitince sadece bunlar stoktan düşer) */
  tracked: boolean;
}

export interface Cart {
  items: CartItem[];
  /** En son eklenen/değişen ürün (ekranda vurgulanır) */
  last: string | null;
}

export const EMPTY_CART: Cart = { items: [], last: null };

/** Okutulan ürünü ekle; zaten varsa adedini 1 artır ve en üste taşı. */
export function addToCart(cart: Cart, p: Omit<CartItem, "qty">): Cart {
  const existing = cart.items.find((i) => i.barcode === p.barcode);
  const item: CartItem = existing ? { ...existing, qty: existing.qty + 1, price: p.price, name: p.name } : { ...p, qty: 1 };
  return { items: [item, ...cart.items.filter((i) => i.barcode !== p.barcode)], last: p.barcode };
}

/** Adedi değiştir; 0 ya da altı olursa satırı sil. */
export function setQty(cart: Cart, barcode: string, qty: number): Cart {
  const items = qty <= 0 ? cart.items.filter((i) => i.barcode !== barcode) : cart.items.map((i) => (i.barcode === barcode ? { ...i, qty } : i));
  return { items, last: qty > 0 ? barcode : cart.last === barcode ? null : cart.last };
}

export function cartTotal(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}
