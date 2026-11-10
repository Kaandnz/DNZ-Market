import { describe, expect, it } from "vitest";
import { parseCsv, planImport, productsToCsv } from "../src/lib/csv";
import type { Product } from "../src/data/types";

const p = (barcode: string, name: string, salePrice: number, extra: Partial<Product> = {}): Product => ({ barcode, name, salePrice, ...extra });

describe("CSV dışa aktarma", () => {
  it("Excel uyumlu: BOM, ; ayırıcı, barkod metin, virgüllü fiyat", () => {
    const csv = productsToCsv([p("8690000000005", 'Gofret; "Çikolatalı"', 125050, { costPrice: 1000, stock: 7, category: "Atıştırmalık" })]);
    expect(csv.startsWith("﻿Barkod;Ürün;")).toBe(true);
    expect(csv).toContain('="8690000000005";"Gofret; ""Çikolatalı""";Atıştırmalık;;1250,50;10,00;7;');
  });

  it("dışa aktarılan dosya geri okunur (gidiş-dönüş)", () => {
    const products = [p("8690000000005", "Gofret", 1250, { costPrice: 1000, stock: 3, minStock: 5, brand: "Ülker" }), p("N123", "Şeker (kg)", 4500)];
    const plan = planImport(parseCsv(productsToCsv(products)), new Map());
    expect(plan.errors).toEqual([]);
    expect(plan.creates.map((r) => [r.barcode, r.name, r.salePrice, r.costPrice, r.stock, r.minStock, r.brand])).toEqual([
      ["8690000000005", "Gofret", 1250, 1000, 3, 5, "Ülker"],
      ["N123", "Şeker (kg)", 4500, undefined, undefined, undefined, undefined],
    ]);
  });

  it("kendi dosyası hiçbir değişiklik üretmez", () => {
    const products = [p("8690000000005", "Gofret", 1250, { costPrice: 1000, stock: 3 })];
    const plan = planImport(parseCsv(productsToCsv(products)), new Map(products.map((x) => [x.barcode, x])));
    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toBe(1);
  });
});

describe("CSV içe aktarma", () => {
  it("virgül ayırıcılı ve farklı başlıklı dosya da okunur", () => {
    const rows = parseCsv('barcode,urun adi,fiyat\n5449000000996,"Coca-Cola, 330 ml",15.5\n');
    const plan = planImport(rows, new Map());
    expect(plan.creates[0]).toMatchObject({ barcode: "5449000000996", name: "Coca-Cola, 330 ml", salePrice: 1550 });
  });

  it("mevcut ürünün sadece değişen alanları güncellenir", () => {
    const existing = new Map([["1234567890128", p("1234567890128", "Gofret", 1000)]]);
    const plan = planImport(parseCsv("Barkod;Satış;Kategori\n1234567890128;12,00;Atıştırmalık\n"), existing);
    expect(plan.updates[0].changes).toEqual(["satış", "kategori"]);
  });

  it("hatalı satırlar ayrılır, diğerleri işlenir", () => {
    const csv = ["Barkod;Ürün;Satış", "8,69E+12;Bozuk;10", ";Fiyatsız;", "1234;Ad;abc", "8690000000005;İyi;5"].join("\n");
    const plan = planImport(parseCsv(csv), new Map());
    expect(plan.errors.map((e) => e.line)).toEqual([2, 3, 4]);
    expect(plan.errors[0].message).toMatch(/Excel/);
    expect(plan.creates.map((r) => r.name)).toEqual(["İyi"]);
  });

  it("aynı barkod iki kez varsa ikincisi hata", () => {
    const plan = planImport(parseCsv("Barkod;Ürün;Satış\n1234;A;1\n1234;B;2\n"), new Map());
    expect(plan.creates).toHaveLength(1);
    expect(plan.errors[0].message).toMatch(/iki kez/);
  });

  it("'Alış fiyatı', 'Satış fiyatı', 'Adet', 'Ürün adı' başlıkları doğru eşlenir", () => {
    const plan = planImport(parseCsv("Ürün adı;Alış fiyatı;Satış fiyatı;Adet\nGofret;8;10;24\n"), new Map());
    expect(plan.creates[0]).toMatchObject({ name: "Gofret", costPrice: 800, salePrice: 1000, stock: 24 });
  });

  it("başlıksız dosya reddedilir", () => {
    expect(planImport(parseCsv("1;2;3\n"), new Map()).errors[0].line).toBe(1);
  });
});
