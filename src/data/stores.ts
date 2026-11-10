import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import type { Invite, Member, Membership, Store, StoreSettings } from "./types";

export const DEFAULT_SETTINGS: StoreSettings = {
  defaultMarginPct: 20,
  rounding: "none",
  soundOn: true,
  stockEnabled: true,
  lowStockDefault: 2,
};

function displayNameOf(user: User): string {
  return user.displayName || user.email?.split("@")[0] || "Kullanıcı";
}

export function watchMemberships(
  uid: string,
  cb: (list: Membership[], fromCache: boolean) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, "users", uid, "memberships"),
    { includeMetadataChanges: true },
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          storeId: d.id,
          role: d.data().role,
          storeName: d.data().storeName,
        })),
        snap.metadata.fromCache,
      ),
    onError,
  );
}

export function watchStore(
  storeId: string,
  cb: (s: Store | null) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, "stores", storeId),
    (snap) => {
      if (!snap.exists()) return cb(null);
      const d = snap.data();
      cb({
        id: snap.id,
        name: d.name,
        ownerUid: d.ownerUid,
        settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
      });
    },
    onError,
  );
}

export function watchMember(
  storeId: string,
  uid: string,
  cb: (m: Member | null) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, "stores", storeId, "members", uid),
    (snap) => {
      if (!snap.exists()) return cb(null);
      const d = snap.data();
      cb({ uid, role: d.role, displayName: d.displayName, canEditPrice: d.role === "owner" || !!d.canEditPrice });
    },
    onError,
  );
}

export function watchMembers(
  storeId: string,
  cb: (list: Member[]) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, "stores", storeId, "members"),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          uid: d.id,
          role: d.data().role,
          displayName: d.data().displayName,
          canEditPrice: d.data().role === "owner" || !!d.data().canEditPrice,
        })),
      ),
    onError,
  );
}

/** Yeni market açar; açan kişi sahibi olur. Tek yazımda: market + üyelik + kullanıcının listesi. */
export async function createStore(user: User, name: string): Promise<string> {
  const storeRef = doc(collection(db, "stores"));
  const batch = writeBatch(db);
  batch.set(storeRef, {
    name: name.trim(),
    ownerUid: user.uid,
    settings: DEFAULT_SETTINGS,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "stores", storeRef.id, "members", user.uid), {
    role: "owner",
    displayName: displayNameOf(user),
    canEditPrice: true,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", user.uid, "memberships", storeRef.id), {
    role: "owner",
    storeName: name.trim(),
  });
  await batch.commit();
  return storeRef.id;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışan harfler (0/O, 1/I) yok

function randomCode(len = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** 7 gün geçerli davet kodu üretir. */
export async function createInvite(
  user: User,
  store: Store,
  canEditPrice: boolean,
): Promise<string> {
  const code = randomCode();
  await setDoc(doc(db, "invites", code), {
    storeId: store.id,
    storeName: store.name,
    role: "staff",
    canEditPrice,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return code;
}

export async function getInvite(code: string): Promise<Invite | null> {
  const snap = await getDoc(doc(db, "invites", code));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { code, ...d } as Invite;
}

/** Davet koduyla markete katılır. */
export async function joinWithInvite(user: User, rawCode: string): Promise<string> {
  const code = normalizeInviteCode(rawCode);
  const invite = await getInvite(code);
  if (!invite) throw new Error("Bu davet kodu bulunamadı.");
  if (invite.expiresAt.toMillis() < Date.now()) throw new Error("Bu davet kodunun süresi dolmuş.");

  const batch = writeBatch(db);
  batch.set(doc(db, "stores", invite.storeId, "members", user.uid), {
    role: "staff",
    displayName: displayNameOf(user),
    canEditPrice: invite.canEditPrice,
    inviteCode: code,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", user.uid, "memberships", invite.storeId), {
    role: "staff",
    storeName: invite.storeName,
  });
  await batch.commit();
  return invite.storeId;
}

/** Market ayarlarını günceller (sadece sahip). Çevrimdışıyken de hemen uygulanır. */
export function updateStoreSettings(storeId: string, patch: Partial<StoreSettings>): Promise<void> {
  return setDoc(doc(db, "stores", storeId), { settings: patch }, { merge: true });
}

export async function setMemberCanEdit(storeId: string, uid: string, canEditPrice: boolean) {
  await setDoc(doc(db, "stores", storeId, "members", uid), { canEditPrice }, { merge: true });
}
