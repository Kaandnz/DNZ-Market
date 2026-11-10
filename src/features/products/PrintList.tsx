import { createPortal } from "react-dom";
import { formatPlain } from "../../lib/money";
import type { Product } from "../../data/types";

interface Props {
  storeName: string;
  title: string;
  products: Product[];
}

/**
 * Sadece yazdırırken görünen A4 fiyat listesi. Uygulamanın dışına (body'ye) çizilir;
 * yazdırma sırasında uygulama gizlenir, bu tablo görünür (bkz. index.css @media print).
 */
export function PrintList({ storeName, title, products }: Props) {
  const now = new Date();
  return createPortal(
    <div className="print-only">
      <header className="print-head">
        <div>
          <div className="print-store">{storeName}</div>
          <div className="print-title">{title}</div>
        </div>
        <div className="print-meta">
          {now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}{" "}
          {now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          <br />
          {products.length} ürün
        </div>
      </header>
      <table className="print-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Ürün</th>
            <th>Barkod</th>
            <th className="price">Fiyat (₺)</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={p.barcode}>
              <td className="num">{i + 1}</td>
              <td>{p.name}</td>
              <td className="code">{p.barcode}</td>
              <td className="price">{formatPlain(p.salePrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
