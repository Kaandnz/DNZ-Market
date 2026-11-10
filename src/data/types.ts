import type { Timestamp } from "firebase/firestore";
import type { Rounding } from "../lib/money";

export type Role = "owner" | "staff";

export interface Membership {
  storeId: string;
  role: Role;
  storeName: string;
}

export interface StoreSettings {
  /** Alışı ilk kez girilen ürünlerde önerilen kâr yüzdesi. */
  defaultMarginPct: number;
  /** Önerilen fiyatların yuvarlanma kuralı. */
  rounding: Rounding;
  soundOn: boolean;
}

export type PriceSource = "manual" | "receiving" | "bulk" | "new" | "import";

export interface PriceChange {
  id: string;
  barcode: string;
  name: string;
  oldSale: number | null;
  newSale: number;
  oldCost: number | null;
  newCost: number | null;
  source: PriceSource;
  uid: string;
  at: Date | null;
}

export interface Store {
  id: string;
  name: string;
  ownerUid: string;
  settings: StoreSettings;
}

export interface Member {
  uid: string;
  role: Role;
  displayName: string;
  canEditPrice: boolean;
}

export interface Product {
  barcode: string;
  name: string;
  nameLower?: string;
  brand?: string | null;
  category?: string | null;
  /** kuruş */
  salePrice: number;
  /** kuruş */
  costPrice?: number | null;
  stock?: number;
  minStock?: number | null;
  labelPending?: boolean;
  deleted?: boolean;
  updatedAt?: Timestamp | null;
  updatedBy?: string;
}

export interface Invite {
  code: string;
  storeId: string;
  storeName: string;
  role: "staff";
  canEditPrice: boolean;
  createdBy: string;
  expiresAt: Timestamp;
}
