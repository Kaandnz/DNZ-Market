import { useLayoutEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { hasValidCheckDigit } from "../../lib/barcode";

/** Barkodun türünü tahmin et: market ürünleri EAN-13/8, iç kodlar Code-128. */
function formatFor(code: string): string {
  if (/^\d{13}$/.test(code) && hasValidCheckDigit(code)) return "EAN13";
  if (/^\d{8}$/.test(code) && hasValidCheckDigit(code)) return "EAN8";
  return "CODE128";
}

/** Etiket üzerindeki barkod çizimi (SVG, yazıcıda net çıkar). */
export function Barcode({ value, height = 28 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: formatFor(value),
        height,
        width: 1.3,
        fontSize: 10,
        margin: 0,
        textMargin: 1,
        background: "transparent",
      });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [value, height]);

  if (failed) return <div className="label-code-text">{value}</div>;
  return <svg ref={ref} className="label-barcode" />;
}
