import { formatPlain, parseTL } from "./money";
import { normalizeBarcode } from "./barcode";
import type { Product } from "../data/types";

/**
 * Ürün yedeği: Excel (Türkçe) ile açılabilen CSV.
 * - Ayırıcı ";" (Türkçe Excel virgülü ondalık için kullanır)
 * - UTF-8 BOM (Türkçe harfler bozulmasın)
 * - Barkod ="8690..." biçiminde (Excel 13 haneli sayıyı 8,69E+12 yapmasın)
 */

const HEADERS = ["Barkod", "Ürün", "Kategori", "Marka", "Satış", "Alış", "Stok", "Uyarı sınırı"] as const;

function cell(v: string): string {
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function productsToCsv(products: Product[]): string {
  const lines = [HEADERS.join(";")];
  for (const p of products) {
    lines.push(
      [
        `="${p.barcode}"`,
        cell(p.name),
        cell(p.category ?? ""),
        cell(p.brand ?? ""),
        formatPlain(p.salePrice).replace(/\./g, ""),
        p.costPrice ? formatPlain(p.costPrice).replace(/\./g, "") : "",
        typeof p.stock === "number" ? String(p.stock) : "",
        p.minStock != null ? String(p.minStock) : "",
      ].join(";"),
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** CSV metnini satır/hücrelere ayırır (tırnaklı hücreler, ; , veya tab ayırıcı). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type Field = "barcode" | "name" | "category" | "brand" | "sale" | "cost" | "stock" | "minStock";

// Sıra önemli: özelden genele. "Alış fiyatı" satış değil alış; "Adet" ad değil stok;
// "Uyarı sınırı" stok değil uyarı; ürün adı en sonda (her şeye benzer).
const HEADER_MAP: [RegExp, Field][] = [
  [/barkod|barcode|kod/, "barcode"],
  [/uyarı|uyari|min/, "minStock"],
  [/stok|adet|miktar|stock/, "stock"],
  [/kategori|category|grup/, "category"],
  [/marka|brand/, "brand"],
  [/alış|alis|maliyet|cost/, "cost"],
  [/satış|satis|fiyat|price/, "sale"],
  [/ürün|urun|ad|isim|name/, "name"],
];

function fieldOf(header: string): Field | null {
  const h = header.trim().toLocaleLowerCase("tr-TR");
  for (const [re, f] of HEADER_MAP) if (re.test(h)) return f;
  return null;
}

/** ="8690..." ya da 8,69E+12 gibi Excel biçimlerinden barkodu kurtar. */
function cleanBarcode(v: string): string {
  const s = v.trim().replace(/^="?|"$/g, "");
  return s;
}

export interface ImportRow {
  line: number;
  /** Boşsa yeni ürüne iç kod verilir. */
  barcode: string | null;
  name?: string;
  category?: string;
  brand?: string;
  salePrice?: number;
  costPrice?: number;
  stock?: number;
  minStock?: number;
}

export interface ImportPlan {
  creates: ImportRow[];
  updates: { row: ImportRow; product: Product; changes: string[] }[];
  unchanged: number;
  errors: { line: number; message: string }[];
}

/** Dosyadaki satırları mevcut ürünlerle karşılaştırır: yeni / değişecek / aynı / hatalı. */
export function planImport(rows: string[][], existing: Map<string, Product>): ImportPlan {
  const plan: ImportPlan = { creates: [], updates: [], unchanged: 0, errors: [] };
  if (rows.length === 0) return plan;
  const fields = rows[0].map(fieldOf);
  if (!fields.includes("name") && !fields.includes("barcode")) {
    plan.errors.push({ line: 1, message: "Başlık satırında 'Barkod' ya da 'Ürün' sütunu bulunamadı." });
    return plan;
  }
  const seen = new Set<string>();

  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (f: Field) => {
      const idx = fields.indexOf(f);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const row: ImportRow = { line, barcode: null };

    const rawCode = cleanBarcode(get("barcode"));
    if (rawCode) {
      if (/e\+/i.test(rawCode)) {
        plan.errors.push({ line, message: `Barkod Excel'de bozulmuş (${rawCode}). Sütunu "Metin" yapıp tekrar kaydet.` });
        return;
      }
      const code = normalizeBarcode(rawCode);
      if (!code) {
        plan.errors.push({ line, message: `Geçersiz barkod: ${rawCode}` });
        return;
      }
      if (seen.has(code)) {
        plan.errors.push({ line, message: `Bu barkod dosyada iki kez var: ${code}` });
        return;
      }
      seen.add(code);
      row.barcode = code;
    }

    const name = get("name");
    if (name) row.name = name.slice(0, 200);
    if (get("category")) row.category = get("category").slice(0, 100);
    if (get("brand")) row.brand = get("brand").slice(0, 100);

    for (const [f, key] of [
      ["sale", "salePrice"],
      ["cost", "costPrice"],
    ] as const) {
      const v = get(f);
      if (!v) continue;
      const k = parseTL(v);
      if (k === null || k <= 0) {
        plan.errors.push({ line, message: `Geçersiz ${f === "sale" ? "satış" : "alış"} fiyatı: ${v}` });
        return;
      }
      row[key] = k;
    }
    for (const [f, key] of [
      ["stock", "stock"],
      ["minStock", "minStock"],
    ] as const) {
      const v = get(f);
      if (!v) continue;
      const n = Number(v.replace(",", "."));
      if (!Number.isInteger(n) || n < -99999 || n > 99999) {
        plan.errors.push({ line, message: `Geçersiz ${f === "stock" ? "stok" : "uyarı sınırı"}: ${v}` });
        return;
      }
      row[key] = n;
    }

    const product = row.barcode ? existing.get(row.barcode) : undefined;
    if (!product) {
      if (!row.name || row.salePrice === undefined) {
        plan.errors.push({ line, message: "Yeni ürün için ürün adı ve satış fiyatı gerekli." });
        return;
      }
      plan.creates.push(row);
      return;
    }

    const changes: string[] = [];
    if (row.name !== undefined && row.name !== product.name) changes.push("ad");
    if (row.salePrice !== undefined && row.salePrice !== product.salePrice) changes.push("satış");
    if (row.costPrice !== undefined && row.costPrice !== (product.costPrice ?? undefined)) changes.push("alış");
    if (row.category !== undefined && row.category !== (product.category ?? undefined)) changes.push("kategori");
    if (row.brand !== undefined && row.brand !== (product.brand ?? undefined)) changes.push("marka");
    if (row.stock !== undefined && row.stock !== product.stock) changes.push("stok");
    if (row.minStock !== undefined && row.minStock !== (product.minStock ?? undefined)) changes.push("uyarı");
    if (changes.length) plan.updates.push({ row, product, changes });
    else plan.unchanged++;
  });

  return plan;
}
