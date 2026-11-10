import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  collection,
  increment,
  type Firestore,
} from "firebase/firestore";

let env: RulesTestEnvironment;
const STORE = "store1";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-dnz",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const db = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;

/** Uygulamanın yaptığı gibi tek yazımda market açar. */
async function createStoreAs(uid: string, storeId = STORE) {
  const d = db(uid);
  const b = writeBatch(d);
  b.set(doc(d, "stores", storeId), { name: "Deniz Bakkal", ownerUid: uid, settings: {}, createdAt: serverTimestamp() });
  b.set(doc(d, "stores", storeId, "members", uid), { role: "owner", displayName: uid, canEditPrice: true });
  b.set(doc(d, "users", uid, "memberships", storeId), { role: "owner", storeName: "Deniz Bakkal" });
  return b.commit();
}

function product(uid: string, salePrice = 1250) {
  return { name: "Gofret", nameLower: "gofret", salePrice, labelPending: true, deleted: false, updatedAt: serverTimestamp(), updatedBy: uid };
}

beforeEach(async () => {
  await env.clearFirestore();
});

describe("market kurulumu", () => {
  it("kullanıcı kendi marketini açabilir", async () => {
    await assertSucceeds(createStoreAs("baba"));
  });

  it("başkası adına market açılamaz", async () => {
    const d = db("baba");
    const b = writeBatch(d);
    b.set(doc(d, "stores", STORE), { name: "X", ownerUid: "kotu" });
    b.set(doc(d, "stores", STORE, "members", "baba"), { role: "owner" });
    await assertFails(b.commit());
  });

  it("var olan markete sahip olarak eklenemez", async () => {
    await createStoreAs("baba");
    await assertFails(setDoc(doc(db("kotu"), "stores", STORE, "members", "kotu"), { role: "owner", canEditPrice: true }));
  });

  it("girişsiz kimse okuyamaz", async () => {
    await createStoreAs("baba");
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore() as unknown as Firestore, "stores", STORE)));
  });
});

describe("ürünler", () => {
  beforeEach(() => createStoreAs("baba"));

  it("sahip fiyat yazar ve okur", async () => {
    await assertSucceeds(setDoc(doc(db("baba"), "stores", STORE, "products", "5449000000996"), product("baba")));
    await assertSucceeds(getDoc(doc(db("baba"), "stores", STORE, "products", "5449000000996")));
  });

  it("üye olmayan okuyamaz ve yazamaz", async () => {
    await assertFails(getDoc(doc(db("yabanci"), "stores", STORE, "products", "5449000000996")));
    await assertFails(setDoc(doc(db("yabanci"), "stores", STORE, "products", "5449000000996"), product("yabanci")));
  });

  it("ondalıklı (kuruş olmayan) fiyat reddedilir", async () => {
    await assertFails(setDoc(doc(db("baba"), "stores", STORE, "products", "1"), { ...product("baba"), salePrice: 12.5 }));
  });

  it("başkası adına updatedBy yazılamaz", async () => {
    await assertFails(setDoc(doc(db("baba"), "stores", STORE, "products", "1"), product("oglu")));
  });

  it("fiyat geçmişi eklenir ama silinemez", async () => {
    const ref = doc(collection(db("baba"), "stores", STORE, "priceChanges"));
    await assertSucceeds(
      setDoc(ref, { barcode: "1", name: "Gofret", oldSale: null, newSale: 1250, source: "new", uid: "baba", at: serverTimestamp() }),
    );
    await assertFails(setDoc(ref, { barcode: "1", newSale: 1, uid: "baba", at: serverTimestamp() }));
  });
});

describe("davet ve yetki", () => {
  async function invite(code: string, canEditPrice: boolean, expiresInMs = 86400000) {
    await assertSucceeds(
      setDoc(doc(db("baba"), "invites", code), {
        storeId: STORE,
        storeName: "Deniz Bakkal",
        role: "staff",
        canEditPrice,
        createdBy: "baba",
        expiresAt: Timestamp.fromMillis(Date.now() + expiresInMs),
      }),
    );
  }

  async function join(uid: string, code: string, canEditPrice: boolean, role = "staff") {
    const d = db(uid);
    const b = writeBatch(d);
    b.set(doc(d, "stores", STORE, "members", uid), { role, displayName: uid, canEditPrice, inviteCode: code });
    b.set(doc(d, "users", uid, "memberships", STORE), { role, storeName: "Deniz Bakkal" });
    return b.commit();
  }

  beforeEach(() => createStoreAs("baba"));

  it("geçerli kodla katılır, fiyat yazabilir", async () => {
    await invite("ABCDEF", true);
    await assertSucceeds(join("oglu", "ABCDEF", true));
    await assertSucceeds(setDoc(doc(db("oglu"), "stores", STORE, "products", "1"), product("oglu")));
  });

  it("yetkisiz çalışan okur ama fiyat yazamaz", async () => {
    await invite("GHJKLM", false);
    await assertSucceeds(join("cirak", "GHJKLM", false));
    await assertSucceeds(getDoc(doc(db("cirak"), "stores", STORE)));
    await assertFails(setDoc(doc(db("cirak"), "stores", STORE, "products", "1"), product("cirak")));
  });

  it("davet yetkisinden fazlasını alamaz", async () => {
    await invite("NPQRST", false);
    await assertFails(join("cirak", "NPQRST", true));
    await assertFails(join("cirak", "NPQRST", false, "owner"));
  });

  it("süresi dolmuş veya olmayan kodla katılamaz", async () => {
    await invite("UVWXYZ", true, -1000);
    await assertFails(join("oglu", "UVWXYZ", true));
    await assertFails(join("oglu", "YOKKOD", true));
  });

  it("çalışan kendi yetkisini yükseltemez", async () => {
    await invite("ABC234", false);
    await join("cirak", "ABC234", false);
    await assertFails(setDoc(doc(db("cirak"), "stores", STORE, "members", "cirak"), { canEditPrice: true }, { merge: true }));
  });

  it("sahip olmayan davet kodu üretemez", async () => {
    await assertFails(
      setDoc(doc(db("yabanci"), "invites", "HACK22"), {
        storeId: STORE,
        storeName: "X",
        role: "staff",
        canEditPrice: true,
        createdBy: "yabanci",
        expiresAt: Timestamp.fromMillis(Date.now() + 1000),
      }),
    );
  });
});

describe("mal kabul ve market ayarları", () => {
  beforeEach(() => createStoreAs("baba"));

  it("mal kabul: stok artışı + alış + stok hareketi + fiyat geçmişi tek yazımda", async () => {
    const d = db("baba");
    await setDoc(doc(d, "stores", STORE, "products", "1"), { ...product("baba"), costPrice: 1000, stock: 3 });
    const b = writeBatch(d);
    b.set(
      doc(d, "stores", STORE, "products", "1"),
      { name: "Gofret", nameLower: "gofret", salePrice: 1450, costPrice: 1200, stock: increment(12), deleted: false, updatedAt: serverTimestamp(), updatedBy: "baba" },
      { merge: true },
    );
    b.set(doc(collection(d, "stores", STORE, "stockMoves")), { barcode: "1", name: "Gofret", type: "in", qty: 12, costPrice: 1200, uid: "baba", at: serverTimestamp() });
    b.set(doc(collection(d, "stores", STORE, "priceChanges")), {
      barcode: "1", name: "Gofret", oldSale: 1250, newSale: 1450, oldCost: 1000, newCost: 1200, source: "receiving", uid: "baba", at: serverTimestamp(),
    });
    await assertSucceeds(b.commit());
    const after = await getDoc(doc(d, "stores", STORE, "products", "1"));
    if (after.data()?.stock !== 15) throw new Error("stok 15 olmalıydı: " + after.data()?.stock);
  });

  it("stok sayı olmalı", async () => {
    await assertFails(setDoc(doc(db("baba"), "stores", STORE, "products", "1"), { ...product("baba"), stock: "çok" }));
  });

  it("sahip ayarları değiştirir, çalışan değiştiremez", async () => {
    await assertSucceeds(setDoc(doc(db("baba"), "stores", STORE), { settings: { defaultMarginPct: 25, rounding: "90" } }, { merge: true }));
    await setDoc(doc(db("baba"), "invites", "ZZZ222"), {
      storeId: STORE, storeName: "Deniz Bakkal", role: "staff", canEditPrice: true, createdBy: "baba", expiresAt: Timestamp.fromMillis(Date.now() + 60000),
    });
    const o = db("oglu");
    const b = writeBatch(o);
    b.set(doc(o, "stores", STORE, "members", "oglu"), { role: "staff", displayName: "oglu", canEditPrice: true, inviteCode: "ZZZ222" });
    b.set(doc(o, "users", "oglu", "memberships", STORE), { role: "staff", storeName: "Deniz Bakkal" });
    await b.commit();
    await assertFails(setDoc(doc(o, "stores", STORE), { settings: { defaultMarginPct: 5 } }, { merge: true }));
  });
});

describe("toplu zam ve sayım", () => {
  beforeEach(() => createStoreAs("baba"));

  it("toplu zam: ürün + geçmiş + geri alma kaydı tek yazımda; sonra geri alındı işareti", async () => {
    const d = db("baba");
    await setDoc(doc(d, "stores", STORE, "products", "1"), product("baba", 1000));
    const op = doc(collection(d, "stores", STORE, "bulkOps"));
    const b = writeBatch(d);
    b.set(op, { label: "%10 zam", count: 1, items: [{ b: "1", n: "Gofret", o: 1000, s: 1100 }], uid: "baba", at: serverTimestamp(), undone: false });
    b.set(doc(d, "stores", STORE, "products", "1"), { salePrice: 1100, labelPending: true, updatedAt: serverTimestamp(), updatedBy: "baba" }, { merge: true });
    b.set(doc(collection(d, "stores", STORE, "priceChanges")), {
      barcode: "1", name: "Gofret", oldSale: 1000, newSale: 1100, oldCost: null, newCost: null, source: "bulk", batchId: op.id, uid: "baba", at: serverTimestamp(),
    });
    await assertSucceeds(b.commit());
    await assertSucceeds(setDoc(op, { undone: true, undoneAt: serverTimestamp(), undoneBy: "baba" }, { merge: true }));
    // Kayıttaki liste sonradan değiştirilemez
    await assertFails(setDoc(op, { items: [] }, { merge: true }));
  });

  it("sayım: stok doğrudan yazılır, hareket kaydı tutulur", async () => {
    const d = db("baba");
    await setDoc(doc(d, "stores", STORE, "products", "1"), { ...product("baba"), stock: 30 });
    const b = writeBatch(d);
    b.set(doc(d, "stores", STORE, "products", "1"), { stock: 27, minStock: 5, updatedAt: serverTimestamp(), updatedBy: "baba" }, { merge: true });
    b.set(doc(collection(d, "stores", STORE, "stockMoves")), { barcode: "1", name: "Gofret", type: "count", qty: -3, stockAfter: 27, uid: "baba", at: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it("kategori ve marka kaydedilir, çok uzun kategori reddedilir", async () => {
    await assertSucceeds(setDoc(doc(db("baba"), "stores", STORE, "products", "1"), { ...product("baba"), category: "Atıştırmalık", brand: "Ülker" }));
    await assertFails(setDoc(doc(db("baba"), "stores", STORE, "products", "2"), { ...product("baba"), category: "x".repeat(101) }));
  });
});

describe("ortak katalog", () => {
  it("girişli kullanıcı isim ekler, fiyat ekleyemez", async () => {
    await assertSucceeds(setDoc(doc(db("baba"), "catalog", "1"), { name: "Gofret", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db("baba"), "catalog", "2"), { name: "Gofret", salePrice: 100 }));
  });
});
