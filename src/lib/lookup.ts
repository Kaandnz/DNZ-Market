import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface NameHit {
  name: string;
  brand?: string;
  source: "catalog" | "openfoodfacts";
}

async function fromCatalog(barcode: string): Promise<NameHit | null> {
  try {
    const snap = await getDoc(doc(db, "catalog", barcode));
    if (snap.exists() && snap.data().name) {
      return { name: snap.data().name, brand: snap.data().brand ?? undefined, source: "catalog" };
    }
  } catch {
    /* çevrimdışı vb. — sıradaki kaynağa geç */
  }
  return null;
}

async function fromOpenFoodFacts(barcode: string): Promise<NameHit | null> {
  if (!/^\d{8,14}$/.test(barcode)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_tr,brands,quantity`,
      { signal: ctrl.signal },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.product;
    const base: string = (p?.product_name_tr || p?.product_name || "").trim();
    if (!base) return null;
    const brand: string | undefined = p.brands?.split(",")[0]?.trim() || undefined;
    const qty: string = (p.quantity || "").trim();
    let name = base;
    // Marka adı zaten ürün adında geçiyorsa ekleme ("COCA-COLA SERVICES SA/NV" → "Coca-Cola ..." zaten var).
    const brandWord = brand?.split(/\s+/)[0]?.toLocaleLowerCase("tr-TR");
    if (brand && brandWord && !name.toLocaleLowerCase("tr-TR").includes(brandWord)) {
      name = `${brand} ${name}`;
    }
    if (qty && !name.toLocaleLowerCase("tr-TR").includes(qty.toLocaleLowerCase("tr-TR"))) {
      name = `${name} ${qty}`;
    }
    return { name: name.slice(0, 200), brand, source: "openfoodfacts" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Barkoddan ürün adını bulmaya çalışır: önce ortak katalog, sonra Open Food Facts. */
export async function lookupName(barcode: string): Promise<NameHit | null> {
  return (await fromCatalog(barcode)) ?? (await fromOpenFoodFacts(barcode));
}

export interface SearchLink {
  label: string;
  url: string;
  /** Site arama kutusuna yapıştırılsın diye adı panoya kopyala. */
  copyName?: boolean;
}

/** İnternette fiyat aramak için hazır linkler. */
export function searchLinks(barcode: string, name?: string): SearchLink[] {
  const q = (name?.trim() || barcode).trim();
  const enc = encodeURIComponent;
  return [
    {
      label: "Google",
      url: `https://www.google.com/search?q=${enc(name?.trim() ? `${q} fiyat` : `${barcode}`)}`,
    },
    { label: "Market Fiyatı", url: `https://marketfiyati.org.tr/ara?q=${enc(q)}`, copyName: true },
    { label: "Akakçe", url: `https://www.akakce.com/arama/?q=${enc(q)}` },
    { label: "Cimri", url: `https://www.cimri.com/arama?q=${enc(q)}` },
  ];
}
