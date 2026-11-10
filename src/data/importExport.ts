import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { errorText, toast } from "../lib/events";
import type { ImportPlan, ImportRow } from "../lib/csv";
import { internalCode } from "./products";
import type { Product } from "./types";

/** Firestore yazımı 500 işlemle sınırlı; ürün başına en fazla 2 yazım. */
const PER_BATCH = 200;

function rowData(row: ImportRow, uid: string, isNew: boolean): Record<string, unknown> {
  const d: Record<string, unknown> = { deleted: false, updatedAt: serverTimestamp(), updatedBy: uid };
  if (row.name !== undefined) {
    d.name = row.name;
    d.nameLower = row.name.toLocaleLowerCase("tr-TR");
  }
  if (row.salePrice !== undefined) d.salePrice = row.salePrice;
  if (row.costPrice !== undefined) d.costPrice = row.costPrice;
  if (row.category !== undefined) d.category = row.category || null;
  if (row.brand !== undefined) d.brand = row.brand || null;
  if (row.stock !== undefined) d.stock = row.stock;
  if (row.minStock !== undefined) d.minStock = row.minStock;
  if (isNew) {
    d.createdAt = serverTimestamp();
    d.labelPending = true;
  }
  return d;
}

/** CSV içe aktarma planını uygular. Fiyatı değişenler fiyat geçmişine "içe aktarma" diye yazılır. */
export function applyImport(storeId: string, uid: string, plan: ImportPlan): number {
  type Op = { barcode: string; data: Record<string, unknown>; change?: Record<string, unknown> };
  const ops: Op[] = [];

  for (const row of plan.creates) {
    const barcode = row.barcode ?? internalCode() + ops.length.toString(36).toUpperCase();
    ops.push({
      barcode,
      data: rowData(row, uid, true),
      change: { barcode, name: row.name, oldSale: null, newSale: row.salePrice, oldCost: null, newCost: row.costPrice ?? null },
    });
  }
  for (const { row, product, changes } of plan.updates) {
    const data = rowData(row, uid, false);
    const priceChanged = changes.includes("satış") || changes.includes("alış");
    if (changes.includes("satış") || changes.includes("ad")) data.labelPending = true;
    ops.push({
      barcode: product.barcode,
      data,
      change: priceChanged
        ? {
            barcode: product.barcode,
            name: row.name ?? product.name,
            oldSale: product.salePrice,
            newSale: row.salePrice ?? product.salePrice,
            oldCost: product.costPrice ?? null,
            newCost: row.costPrice ?? product.costPrice ?? null,
          }
        : undefined,
    });
  }

  for (let i = 0; i < ops.length; i += PER_BATCH) {
    const b = writeBatch(db);
    for (const op of ops.slice(i, i + PER_BATCH)) {
      b.set(doc(db, "stores", storeId, "products", op.barcode), op.data, { merge: true });
      if (op.change) {
        b.set(doc(collection(db, "stores", storeId, "priceChanges")), { ...op.change, source: "import", uid, at: serverTimestamp() });
      }
    }
    b.commit().catch((e) => toast("İçe aktarmanın bir kısmı kaydedilemedi: " + errorText(e), "error"));
  }
  return ops.length;
}

/** Basılan etiketleri "basıldı" işaretle (Etiketler listesinden düşer). */
export function markLabelsPrinted(storeId: string, uid: string, products: Product[]): void {
  for (let i = 0; i < products.length; i += 400) {
    const b = writeBatch(db);
    for (const p of products.slice(i, i + 400)) {
      b.set(
        doc(db, "stores", storeId, "products", p.barcode),
        { labelPending: false, updatedAt: serverTimestamp(), updatedBy: uid },
        { merge: true },
      );
    }
    b.commit().catch((e) => toast(errorText(e), "error"));
  }
}

/** Metni dosya olarak indirt. */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
