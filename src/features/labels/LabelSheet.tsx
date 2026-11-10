import { createPortal } from "react-dom";
import { formatPlain } from "../../lib/money";
import { Barcode } from "./Barcode";
import type { Product } from "../../data/types";

export type LabelSize = "small" | "medium" | "large";

export const LABEL_SIZES: { value: LabelSize; label: string; perPage: number }[] = [
  { value: "small", label: "Küçük · 24'lü", perPage: 24 },
  { value: "medium", label: "Orta · 18'li", perPage: 18 },
  { value: "large", label: "Büyük · 8'li", perPage: 8 },
];

interface Props {
  storeName: string;
  products: Product[];
  size: LabelSize;
  /** Ekranda önizleme olarak da göster (yazdırmada her zaman görünür). */
  preview?: boolean;
}

/**
 * A4 raf etiketleri: ürün adı, büyük fiyat, barkod, tarih. Kesme çizgileri soluk kesikli.
 * Yazdırırken uygulama gizlenir, sadece bu sayfa basılır (bkz. index.css).
 */
export function LabelSheet({ storeName, products, size, preview }: Props) {
  const date = new Date().toLocaleDateString("tr-TR");
  const perPage = LABEL_SIZES.find((s) => s.value === size)!.perPage;
  const render = (list: Product[]) => (
    <div className={`label-sheet label-${size}`}>
      {list.map((p) => {
        const [lira, kurus] = formatPlain(p.salePrice).split(",");
        return (
          <div key={p.barcode} className="label">
            <div className="label-top">
              <span>{storeName}</span>
              <span>{date}</span>
            </div>
            <div className="label-name">{p.name}</div>
            <div className="label-price">
              <span className="label-lira">{lira}</span>
              <span className="label-kurus">,{kurus}</span>
              <span className="label-tl">₺</span>
            </div>
            <div className="label-bottom">
              <Barcode value={p.barcode} height={size === "large" ? 34 : size === "medium" ? 24 : 18} />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {preview && <div className="label-preview">{render(products.slice(0, perPage))}</div>}
      {createPortal(<div className="print-only">{render(products)}</div>, document.body)}
    </>
  );
}
