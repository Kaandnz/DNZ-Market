import { roundPrice, type Rounding } from "./money";
import type { Product } from "../data/types";

/** Toplu zam hesapları (Firebase'siz, test edilebilir). */

export interface BulkRule {
  direction: "up" | "down";
  kind: "pct" | "tl";
  /** % ise yüzde (10 = %10), ₺ ise kuruş. */
  amount: number;
  rounding: Rounding;
}

export interface BulkItem {
  barcode: string;
  name: string;
  oldSale: number;
  newSale: number;
}

/** Bir ürünün toplu zamdan sonraki fiyatı. Fiyat 0'ın altına düşmez; değişmiyorsa null. */
export function bulkPrice(sale: number, rule: BulkRule): number | null {
  if (!(rule.amount > 0)) return null;
  const sign = rule.direction === "up" ? 1 : -1;
  const raw = rule.kind === "pct" ? sale * (1 + (sign * rule.amount) / 100) : sale + sign * rule.amount;
  if (raw <= 0) return null;
  const next = roundPrice(raw, rule.rounding);
  return next === sale ? null : next;
}

/** Önizleme: değişecek ürünler, eski → yeni. */
export function computeBulk(products: Product[], rule: BulkRule): BulkItem[] {
  const out: BulkItem[] = [];
  for (const p of products) {
    const n = bulkPrice(p.salePrice, rule);
    if (n !== null) out.push({ barcode: p.barcode, name: p.name, oldSale: p.salePrice, newSale: n });
  }
  return out;
}

/** Geri alınabilecek ürünler: toplu zamdan sonra fiyatı başka biri değiştirmemiş olanlar. */
export function undoableItems(items: BulkItem[], current: Map<string, Product>): BulkItem[] {
  return items.filter((it) => {
    const p = current.get(it.barcode);
    return p && !p.deleted && p.salePrice === it.newSale;
  });
}
