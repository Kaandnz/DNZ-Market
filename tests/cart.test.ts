import { describe, expect, it } from "vitest";
import { EMPTY_CART, addToCart, cartCount, cartTotal, setQty } from "../src/lib/cart";

const gofret = { barcode: "1", name: "Gofret", price: 1250, tracked: true };
const su = { barcode: "2", name: "Su", price: 500, tracked: false };

describe("satış sepeti", () => {
  it("okutulan ürünler toplanır", () => {
    let c = addToCart(EMPTY_CART, gofret);
    c = addToCart(c, su);
    expect(cartTotal(c)).toBe(1750);
    expect(cartCount(c)).toBe(2);
  });

  it("aynı ürün tekrar okutulunca adet artar, en üste çıkar", () => {
    let c = addToCart(EMPTY_CART, gofret);
    c = addToCart(c, su);
    c = addToCart(c, gofret);
    expect(c.items.map((i) => [i.barcode, i.qty])).toEqual([
      ["1", 2],
      ["2", 1],
    ]);
    expect(cartTotal(c)).toBe(3000);
    expect(c.last).toBe("1");
  });

  it("adet elle değiştirilir, 0 olunca satır silinir", () => {
    let c = addToCart(addToCart(EMPTY_CART, gofret), su);
    c = setQty(c, "1", 5);
    expect(cartTotal(c)).toBe(5 * 1250 + 500);
    c = setQty(c, "2", 0);
    expect(c.items.map((i) => i.barcode)).toEqual(["1"]);
  });

  it("boş sepetin toplamı 0", () => {
    expect(cartTotal(EMPTY_CART)).toBe(0);
    expect(cartCount(EMPTY_CART)).toBe(0);
  });
});
