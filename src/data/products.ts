import {
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { errorText, toast } from "../lib/events";
import type { PriceChange, PriceSource, Product } from "./types";

export type ProductState =
  | { status: "loading" }
  | { status: "found"; product: Product; fromCache: boolean }
  | { status: "missing" }
  /** Cihazda yok ve internet de yok: kayıtlı mı bilemiyoruz. */
  | { status: "unknown-offline" };

/**
 * Okutulan ürünü izler: önce cihazdaki önbellekten anında gösterir, sonra sunucudan
 * tazeler; başka cihazda fiyat değişirse ekran kendiliğinden güncellenir.
 */
export function watchProduct(
  storeId: string,
  barcode: string,
  cb: (s: ProductState) => void,
): () => void {
  return onSnapshot(
    doc(db, "stores", storeId, "products", barcode),
    { includeMetadataChanges: true },
    (snap) => {
      const fromCache = snap.metadata.fromCache;
      if (snap.exists() && !snap.data().deleted) {
        cb({ status: "found", product: { barcode, ...(snap.data() as Omit<Product, "barcode">) }, fromCache });
      } else if (!fromCache) {
        cb({ status: "missing" });
      } else {
        cb(navigator.onLine ? { status: "loading" } : { status: "unknown-offline" });
      }
    },
    (e) => {
      toast(errorText(e), "error");
      cb({ status: "unknown-offline" });
    },
  );
}

/**
 * Yazımı arka planda gönderir. Çevrimdışıyken de değişiklik cihazda hemen görünür;
 * internet gelince Firestore kendisi gönderir. Bu yüzden commit beklenmez.
 */
function commitInBackground(batch: ReturnType<typeof writeBatch>) {
  batch.commit().catch((e) => toast("Kaydedilemedi: " + errorText(e), "error"));
}

export interface SavePriceInput {
  storeId: string;
  uid: string;
  barcode: string;
  /** Mevcut ürün; yeni ürünse null. */
  existing: Product | null;
  name?: string;
  salePrice: number;
  /** Verilmezse alış fiyatına dokunulmaz. */
  costPrice?: number | null;
  /** Mal kabulde gelen adet; stoka eklenir. */
  qty?: number;
  /** Verilmezse dokunulmaz; boş metin = sil. */
  category?: string;
  brand?: string;
  source: PriceSource;
  /** Ürün adını marketler arası ortak havuza da yaz (havuzda yoksa). */
  shareToCatalog?: boolean;
}

/**
 * Ürünü kaydeder: fiyat / alış / ad / stok. Fiyat değiştiyse fiyat geçmişine yazar ve
 * etiketi "basılacak" işaretler; adet geldiyse stok hareketi yazar. Hepsi tek yazımda.
 */
export function savePrice(input: SavePriceInput): void {
  const { storeId, uid, barcode, existing } = input;
  const name = (input.name ?? existing?.name ?? "").trim();
  const batch = writeBatch(db);
  const productRef = doc(db, "stores", storeId, "products", barcode);

  const saleChanged = !existing || existing.salePrice !== input.salePrice;
  const costChanged = input.costPrice !== undefined && (existing?.costPrice ?? null) !== input.costPrice;
  const nameChanged = !existing || existing.name !== name;

  const data: Record<string, unknown> = {
    name,
    nameLower: name.toLocaleLowerCase("tr-TR"),
    salePrice: input.salePrice,
    deleted: false,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  // Raf etiketi sadece etikette yazan bir şey (ad / fiyat) değişince yeniden basılmalı.
  if (saleChanged || nameChanged) data.labelPending = true;
  if (input.costPrice !== undefined) data.costPrice = input.costPrice;
  if (input.category !== undefined) data.category = input.category.trim().slice(0, 100) || null;
  if (input.brand !== undefined) data.brand = input.brand.trim().slice(0, 100) || null;
  if (!existing) data.createdAt = serverTimestamp();
  if (input.qty && input.qty > 0) data.stock = increment(input.qty);
  batch.set(productRef, data, { merge: true });

  if (input.qty && input.qty > 0) {
    batch.set(doc(collection(db, "stores", storeId, "stockMoves")), {
      barcode,
      name,
      type: "in",
      qty: input.qty,
      costPrice: input.costPrice ?? existing?.costPrice ?? null,
      uid,
      at: serverTimestamp(),
    });
  }

  if (saleChanged || costChanged) {
    batch.set(doc(collection(db, "stores", storeId, "priceChanges")), {
      barcode,
      name,
      oldSale: existing?.salePrice ?? null,
      newSale: input.salePrice,
      oldCost: existing?.costPrice ?? null,
      newCost: input.costPrice ?? existing?.costPrice ?? null,
      source: input.source,
      uid,
      at: serverTimestamp(),
    });
  }

  commitInBackground(batch);

  // Ortak havuz ayrı yazılır: orada bir sorun çıkarsa fiyat kaydı etkilenmesin.
  if (input.shareToCatalog && name) {
    setDoc(doc(db, "catalog", barcode), { name, updatedAt: serverTimestamp() }).catch(() => {});
  }
}

function toChange(d: QueryDocumentSnapshot): PriceChange {
  const x = d.data({ serverTimestamps: "estimate" });
  return {
    id: d.id,
    barcode: x.barcode,
    name: x.name ?? "",
    oldSale: x.oldSale ?? null,
    newSale: x.newSale,
    oldCost: x.oldCost ?? null,
    newCost: x.newCost ?? null,
    source: x.source ?? "manual",
    uid: x.uid,
    at: x.at?.toDate?.() ?? null,
  };
}

/** Son fiyat değişiklikleri (yeniden eskiye). */
export function watchHistory(
  storeId: string,
  max: number,
  cb: (list: PriceChange[], fromCache: boolean) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, "stores", storeId, "priceChanges"), orderBy("at", "desc"), limit(max)),
    (snap) => cb(snap.docs.map(toChange), snap.metadata.fromCache),
    onError,
  );
}

/** Tek ürünün son fiyat değişiklikleri. */
export function watchProductHistory(
  storeId: string,
  barcode: string,
  cb: (list: PriceChange[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, "stores", storeId, "priceChanges"),
      where("barcode", "==", barcode),
      orderBy("at", "desc"),
      limit(5),
    ),
    (snap) => cb(snap.docs.map(toChange)),
    () => cb([]),
  );
}

/**
 * Sayım: rafta gerçekte kaç tane olduğu yazılır, stok bu sayıya eşitlenir.
 * Fark stok hareketi olarak kaydedilir. İstenirse azalınca uyarı sınırı da ayarlanır.
 */
export function setStockCount(
  storeId: string,
  uid: string,
  product: Product,
  count: number,
  minStock?: number | null,
): void {
  const batch = writeBatch(db);
  const data: Record<string, unknown> = { stock: count, updatedAt: serverTimestamp(), updatedBy: uid };
  if (minStock !== undefined) data.minStock = minStock;
  batch.set(doc(db, "stores", storeId, "products", product.barcode), data, { merge: true });
  const diff = count - (product.stock ?? 0);
  if (diff !== 0 || product.stock === undefined) {
    batch.set(doc(collection(db, "stores", storeId, "stockMoves")), {
      barcode: product.barcode,
      name: product.name,
      type: "count",
      qty: diff,
      stockAfter: count,
      uid,
      at: serverTimestamp(),
    });
  }
  commitInBackground(batch);
}

/** Azalan sayılır: stok tutuluyorsa ve uyarı sınırına (yoksa 2) indiyse. */
export const DEFAULT_MIN_STOCK = 2;
export function isLowStock(p: Product): boolean {
  return typeof p.stock === "number" && p.stock <= (p.minStock ?? DEFAULT_MIN_STOCK);
}

/** Barkodu olmayan ürün (dökme, ekmek vb.) için kısa iç kod. */
export function internalCode(): string {
  return "N" + Date.now().toString(36).toUpperCase();
}

/**
 * Ürünü siler. Gerçekten silinmez, "silindi" işaretlenir: böylece diğer cihazlar da
 * listeden kaldırır (değişen ürünleri çekerken silineni de görürler). Barkod tekrar
 * okutulursa "kayıtlı değil" olarak yeniden eklenebilir.
 */
export function deleteProduct(storeId: string, uid: string, barcode: string): void {
  const batch = writeBatch(db);
  batch.set(
    doc(db, "stores", storeId, "products", barcode),
    { deleted: true, updatedAt: serverTimestamp(), updatedBy: uid },
    { merge: true },
  );
  commitInBackground(batch);
}
