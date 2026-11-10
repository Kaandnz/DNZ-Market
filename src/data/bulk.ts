import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { errorText, toast } from "../lib/events";
import { undoableItems, type BulkItem } from "../lib/bulkMath";
import type { Product } from "./types";

export { bulkPrice, computeBulk, undoableItems, type BulkItem, type BulkRule } from "../lib/bulkMath";

export interface BulkOp {
  id: string;
  label: string;
  count: number;
  items: BulkItem[];
  at: Date | null;
  undone: boolean;
}

/** Firestore yazımı 500 işlemle sınırlı: ürün başına 2 yazım (ürün + geçmiş). */
const PER_BATCH = 200;

function writeItems(storeId: string, uid: string, items: BulkItem[], batchId: string, extra?: (b: ReturnType<typeof writeBatch>) => void) {
  const chunks: BulkItem[][] = [];
  for (let i = 0; i < items.length; i += PER_BATCH) chunks.push(items.slice(i, i + PER_BATCH));
  if (chunks.length === 0) chunks.push([]); // geri alınacak ürün kalmasa da kayıt güncellensin

  chunks.forEach((part, idx) => {
    const b = writeBatch(db);
    if (idx === 0) extra?.(b);
    for (const it of part) {
      b.set(
        doc(db, "stores", storeId, "products", it.barcode),
        { salePrice: it.newSale, labelPending: true, updatedAt: serverTimestamp(), updatedBy: uid },
        { merge: true },
      );
      b.set(doc(collection(db, "stores", storeId, "priceChanges")), {
        barcode: it.barcode,
        name: it.name,
        oldSale: it.oldSale,
        newSale: it.newSale,
        oldCost: null,
        newCost: null,
        source: "bulk",
        batchId,
        uid,
        at: serverTimestamp(),
      });
    }
    b.commit().catch((e) => toast("Toplu zamın bir kısmı kaydedilemedi: " + errorText(e), "error"));
  });
}

/** Toplu zamı uygular ve geri alabilmek için kaydını tutar. Çevrimdışı da çalışır. */
export function applyBulk(storeId: string, uid: string, items: BulkItem[], label: string): string {
  const opRef = doc(collection(db, "stores", storeId, "bulkOps"));
  writeItems(storeId, uid, items, opRef.id, (b) =>
    b.set(opRef, {
      label,
      count: items.length,
      items: items.map((it) => ({ b: it.barcode, n: it.name, o: it.oldSale, s: it.newSale })),
      uid,
      at: serverTimestamp(),
      undone: false,
    }),
  );
  return opRef.id;
}

/** Toplu zamı geri alır (sadece o zamdan beri fiyatı değişmemiş ürünler). */
export function undoBulk(storeId: string, uid: string, op: BulkOp, current: Map<string, Product>): number {
  const back = undoableItems(op.items, current).map((it) => ({ ...it, oldSale: it.newSale, newSale: it.oldSale }));
  writeItems(storeId, uid, back, op.id + "-geri", (b) =>
    b.set(
      doc(db, "stores", storeId, "bulkOps", op.id),
      { undone: true, undoneAt: serverTimestamp(), undoneBy: uid },
      { merge: true },
    ),
  );
  return back.length;
}

/** Son toplu işlemler (geri alma için). */
export function watchBulkOps(storeId: string, cb: (ops: BulkOp[]) => void): () => void {
  return onSnapshot(
    query(collection(db, "stores", storeId, "bulkOps"), orderBy("at", "desc"), limit(5)),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: "estimate" });
          return {
            id: d.id,
            label: x.label ?? "",
            count: x.count ?? 0,
            items: (x.items ?? []).map((i: { b: string; n: string; o: number; s: number }) => ({
              barcode: i.b,
              name: i.n,
              oldSale: i.o,
              newSale: i.s,
            })),
            at: x.at?.toDate?.() ?? null,
            undone: !!x.undone,
          };
        }),
      ),
    () => cb([]),
  );
}
