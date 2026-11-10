import { useCallback, useEffect, useState } from "react";
import {
  collection,
  getDocsFromCache,
  onSnapshot,
  query,
  Timestamp,
  where,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { errorText } from "../../lib/events";
import { storage } from "../../lib/feedback";
import type { Product } from "../../data/types";

const syncKey = (storeId: string) => `dnz.sync.${storeId}`;
/** Farklı cihazların yazımları sunucuda birkaç sn sırasız görünebilir; aralığı biraz geniş tut. */
const SAFETY_MS = 60_000;

function toProduct(d: DocumentSnapshot): Product {
  return { barcode: d.id, ...(d.data() as Omit<Product, "barcode">) };
}

/**
 * Marketin tüm ürünleri. Ücretsiz plandaki günlük okuma sınırını korumak için:
 * 1) Liste önce telefondaki önbellekten anında gelir (sunucu okuması yok).
 * 2) Sunucudan sadece son eşitlemeden beri değişen ürünler çekilir.
 * 3) Ekran açıkken başka cihazdaki değişiklikler canlı gelir.
 * İlk açılışta (önbellek boşken) tüm ürünler bir kez indirilir.
 */
export function useProductList(storeId: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    const map = new Map<string, Product>();
    const col = collection(db, "stores", storeId, "products");
    const emit = () => {
      if (!cancelled) setProducts([...map.values()].filter((p) => !p.deleted && p.name));
    };

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const cached = await getDocsFromCache(col);
        cached.forEach((d) => map.set(d.id, toProduct(d)));
      } catch {
        /* önbellek okunamadı: sunucudan tamamını al */
      }
      if (cancelled) return;
      emit();
      if (map.size > 0) setLoading(false);

      const saved = Number(storage.get(syncKey(storeId)) || 0);
      const since = map.size === 0 ? 0 : Math.max(0, saved - SAFETY_MS);
      const q = since > 0 ? query(col, where("updatedAt", ">=", Timestamp.fromMillis(since))) : query(col);

      unsub = onSnapshot(
        q,
        (snap) => {
          let max = saved;
          for (const ch of snap.docChanges()) {
            // "removed": sorgudan çıktı (ör. kayıt bekleyen saat damgası); listede kalsın.
            if (ch.type === "removed") continue;
            map.set(ch.doc.id, toProduct(ch.doc));
          }
          for (const d of snap.docs) {
            const t = (d.get("updatedAt") as Timestamp | null)?.toMillis?.();
            if (t && t > max) max = t;
          }
          if (!snap.metadata.fromCache) {
            storage.set(syncKey(storeId), String(max));
            setLoading(false);
          }
          emit();
        },
        (e) => {
          if (cancelled) return;
          setError(errorText(e));
          setLoading(false);
        },
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [storeId, reloadKey]);

  /** Tüm listeyi sunucudan baştan çek (bir şey eksik görünürse). */
  const refresh = useCallback(() => {
    storage.set(syncKey(storeId), "0");
    setReloadKey((k) => k + 1);
  }, [storeId]);

  return { products, loading, error, refresh };
}
