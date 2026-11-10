import { useEffect, useState } from "react";
import { storage } from "./feedback";

/**
 * Cihaza özel tercihler (localStorage). Değişince açık olan bütün ekranlar
 * aynı anda güncellensin diye olay yayınlanır.
 */
const HIDE_COST_KEY = "dnz.hideCost";
const EVENT = "dnz-prefs";

export function getHideCost(): boolean {
  return storage.get(HIDE_COST_KEY) === "1";
}

export function setHideCost(on: boolean) {
  storage.set(HIDE_COST_KEY, on ? "1" : "");
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Alış fiyatı ve kâr bu telefonda gizli mi? (Müşteri ekranı görse de alışı görmesin.)
 * Mal Kabul hariç her yerde uygulanır.
 */
export function useHideCost(): boolean {
  const [hide, setHide] = useState(getHideCost);
  useEffect(() => {
    const on = () => setHide(getHideCost());
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return hide;
}
