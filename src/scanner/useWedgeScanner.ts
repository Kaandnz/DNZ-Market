import { useEffect, useRef } from "react";
import { normalizeBarcode } from "../lib/barcode";

/**
 * USB / Bluetooth barkod tabancaları klavye gibi çok hızlı yazıp Enter'a basar.
 * Bir yazı kutusu odakta değilken bu hızlı girişi yakalayıp barkod olarak verir.
 */
export function useWedgeScanner(enabled: boolean, onScan: (code: string) => void) {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buf = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const now = performance.now();
      if (now - last > 60) buf = "";
      last = now;
      if (e.key === "Enter") {
        const code = normalizeBarcode(buf);
        buf = "";
        if (code && code.length >= 6) {
          e.preventDefault();
          cb.current(code);
        }
        return;
      }
      if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
