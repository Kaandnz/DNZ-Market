import { describe, expect, it } from "vitest";
import { applyKey, applyQtyKey, formatPct, formatTL, marginPct, parseTL, roundPrice, suggestSale } from "../src/lib/money";
import { hasValidCheckDigit, isPlausibleBarcode, normalizeBarcode } from "../src/lib/barcode";

describe("parseTL", () => {
  it.each([
    ["12,50", 1250],
    ["12,5", 1250],
    ["12.5", 1250],
    ["12", 1200],
    ["0,99", 99],
    [",5", 50],
    ["1.250", 125000],
    ["1.250,75", 125075],
    ["1,250.75", 125075],
    ["₺ 7", 700],
    ["7 TL", 700],
  ])("%s → %i kuruş", (input, expected) => {
    expect(parseTL(input)).toBe(expected);
  });

  it.each(["", "abc", "12,345", "1,2,3", "-5", "99999999"])("geçersiz: %s", (input) => {
    expect(parseTL(input)).toBeNull();
  });
});

describe("applyKey (tuş takımı)", () => {
  const type = (keys: string[]) => keys.reduce((v, k) => applyKey(v, k), "");
  it("rakam ve virgül", () => expect(type(["1", "2", ",", "5", "0"])).toBe("12,50"));
  it("en fazla iki ondalık", () => expect(type(["1", ",", "2", "3", "4"])).toBe("1,23"));
  it("tek virgül", () => expect(type(["1", ",", ","])).toBe("1,"));
  it("virgülle başlarsa 0, eklenir", () => expect(type([",", "5"])).toBe("0,5"));
  it("baştaki sıfır atılır", () => expect(type(["0", "7"])).toBe("7"));
  it("sil", () => expect(type(["1", "2", "back"])).toBe("1"));
  it("tuş takımı çıktısı parseTL ile okunur", () => expect(parseTL(type(["1", "2", ",", "5"]))).toBe(1250));
});

describe("formatTL / marginPct", () => {
  it("biçim", () => expect(formatTL(1250).replace(/\s/g, "")).toBe("₺12,50"));
  it("kâr yüzdesi", () => expect(marginPct(1200, 1000)).toBeCloseTo(20));
  it("alış yoksa null", () => expect(marginPct(1200, null)).toBeNull());
});

describe("yuvarlama ve öneri", () => {
  it.each([
    [1234, "none", 1234],
    [1234, "25", 1250],
    [1250, "25", 1250],
    [1201, "50", 1250],
    [1234, "90", 1290],
    [1290, "90", 1290],
    [1295, "90", 1390],
    [1201, "100", 1300],
    [1200, "100", 1200],
  ] as const)("%i kuruş, %s → %i", (k, r, expected) => {
    expect(roundPrice(k, r)).toBe(expected);
  });

  it("kesirli kuruş yukarı yuvarlanır", () => expect(roundPrice(1234.2, "none")).toBe(1235));
  it("10 ₺ alış, %20 kâr, ,50 yuvarlama → 12,00", () => expect(suggestSale(1000, 20, "50")).toBe(1200));
  it("10,40 ₺ alış, %25 kâr, ,90 → 13,90", () => expect(suggestSale(1040, 25, "90")).toBe(1390));
  it("kâr hiç düşmez", () => {
    const s = suggestSale(777, 18, "25");
    expect(marginPct(s, 777)!).toBeGreaterThanOrEqual(18);
  });
  it("yüzde gösterimi", () => {
    expect(formatPct(25)).toBe("%25");
    expect(formatPct(12.345)).toBe("%12,3");
  });
  it("adet tuş takımı", () => {
    const type = (keys: string[]) => keys.reduce((v, k) => applyQtyKey(v, k), "");
    expect(type(["1", ",", "2"])).toBe("12");
    expect(type(["0", "5"])).toBe("5");
    expect(type(["9", "9", "9", "9", "9", "9"])).toBe("99999");
  });
});

describe("barkod", () => {
  it("EAN-13 kontrol hanesi", () => {
    expect(hasValidCheckDigit("5449000000996")).toBe(true);
    expect(hasValidCheckDigit("5449000000997")).toBe(false);
  });
  it("EAN-8", () => expect(hasValidCheckDigit("96385074")).toBe(true));
  it("UPC-A → EAN-13", () => expect(normalizeBarcode("036000291452")).toBe("0036000291452"));
  it("boşluk temizlenir", () => expect(normalizeBarcode(" 5449000000996 ")).toBe("5449000000996"));
  it("Firestore kimliğini bozacak karakter reddedilir", () => expect(normalizeBarcode("12/34/56")).toBeNull());
  it("yanlış okunmuş EAN elenir", () => expect(isPlausibleBarcode("5449000000997")).toBe(false));
  it("Code-128 kabul", () => expect(isPlausibleBarcode("ABC-1234")).toBe(true));
});
