import { describe, expect, it } from "vitest";
import { bulkPrice, computeBulk, undoableItems, type BulkRule } from "../src/lib/bulkMath";
import type { Product } from "../src/data/types";

const rule = (r: Partial<BulkRule>): BulkRule => ({ direction: "up", kind: "pct", amount: 10, rounding: "none", ...r });
const p = (barcode: string, salePrice: number, extra: Partial<Product> = {}): Product => ({ barcode, name: barcode, salePrice, ...extra });

describe("toplu zam fiyatı", () => {
  it("%10 zam", () => expect(bulkPrice(1000, rule({}))).toBe(1100));
  it("%10 zam, ,50 yuvarlama", () => expect(bulkPrice(1234, rule({ rounding: "50" }))).toBe(1400));
  it("₺2 zam", () => expect(bulkPrice(1000, rule({ kind: "tl", amount: 200 }))).toBe(1200));
  it("%10 indirim", () => expect(bulkPrice(1000, rule({ direction: "down" }))).toBe(900));
  it("fiyat sıfırın altına düşmez", () => expect(bulkPrice(100, rule({ direction: "down", kind: "tl", amount: 500 }))).toBeNull());
  it("değişmeyen ürün atlanır", () => expect(bulkPrice(1290, rule({ amount: 0.1, rounding: "90" }))).toBe(1390));
  it("0 miktar = değişiklik yok", () => expect(bulkPrice(1000, rule({ amount: 0 }))).toBeNull());
  it("kesirli kuruş yukarı yuvarlanır", () => expect(bulkPrice(333, rule({ amount: 10 }))).toBe(367));
});

describe("önizleme ve geri alma", () => {
  const products = [p("a", 1000), p("b", 2000), p("c", 50)];

  it("önizleme eski → yeni", () => {
    const items = computeBulk(products, rule({}));
    expect(items.map((i) => [i.barcode, i.oldSale, i.newSale])).toEqual([
      ["a", 1000, 1100],
      ["b", 2000, 2200],
      ["c", 50, 55],
    ]);
  });

  it("zamdan sonra elle değiştirilen ürün geri alınmaz", () => {
    const items = computeBulk(products, rule({}));
    const now = new Map([
      ["a", p("a", 1100)],
      ["b", p("b", 2500)], // biri elle değiştirmiş
      ["c", p("c", 55, { deleted: true })], // silinmiş
    ]);
    expect(undoableItems(items, now).map((i) => i.barcode)).toEqual(["a"]);
  });
});
