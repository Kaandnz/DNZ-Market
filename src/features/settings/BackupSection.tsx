import { useMemo, useRef, useState } from "react";
import { useActiveStore } from "../store/StoreProvider";
import { useUser } from "../auth/AuthProvider";
import { useProductList } from "../products/useProductList";
import { parseCsv, planImport, productsToCsv, type ImportPlan } from "../../lib/csv";
import { applyImport, downloadText } from "../../data/importExport";
import { toast } from "../../lib/events";
import { beepSaved } from "../../lib/feedback";

/** Sahip için: tüm ürünleri CSV (Excel) olarak indir ya da CSV'den toplu yükle. */
export function BackupSection() {
  const { store, isOwner } = useActiveStore();
  if (!isOwner) return null;
  return <Backup storeId={store.id} storeName={store.name} />;
}

function Backup({ storeId, storeName }: { storeId: string; storeName: string }) {
  const user = useUser();
  const { products, loading } = useProductList(storeId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState("");
  const existing = useMemo(() => new Map(products.map((p) => [p.barcode, p])), [products]);

  function exportCsv() {
    const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
    const date = new Date().toISOString().slice(0, 10);
    const safe = storeName.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "market";
    downloadText(`${safe}-urunler-${date}.csv`, productsToCsv(sorted));
    toast(`${sorted.length} ürün indirildi.`, "info");
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast("Dosya çok büyük (en fazla 5 MB).", "error");
      return;
    }
    const text = await f.text();
    setFileName(f.name);
    setPlan(planImport(parseCsv(text), existing));
    if (fileRef.current) fileRef.current.value = "";
  }

  function apply() {
    if (!plan) return;
    const n = applyImport(storeId, user.uid, plan);
    beepSaved();
    toast(`${n} ürün kaydedildi.`);
    setPlan(null);
  }

  const total = plan ? plan.creates.length + plan.updates.length : 0;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h3 className="font-semibold">Yedek (Excel / CSV)</h3>
      <p className="mb-3 text-xs text-stone-500">
        Ürünleri indirip Excel'de açabilir, düzenleyip geri yükleyebilirsin. Ürünler zaten bulutta saklanıyor; bu ek bir güvencedir.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={exportCsv}
          disabled={loading || products.length === 0}
          className="h-12 rounded-2xl bg-stone-800 font-semibold text-white active:bg-stone-900 disabled:opacity-40"
        >
          ⬇ İndir ({products.length})
        </button>
        <button onClick={() => fileRef.current?.click()} className="h-12 rounded-2xl bg-stone-100 font-semibold text-stone-800 active:bg-stone-200">
          ⬆ Dosyadan yükle
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      {plan && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-stone-50 p-4">
          <div className="truncate text-sm font-medium text-stone-600">{fileName}</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white p-2">
              <div className="text-2xl font-bold text-emerald-700">{plan.creates.length}</div>
              <div className="text-xs text-stone-500">yeni</div>
            </div>
            <div className="rounded-xl bg-white p-2">
              <div className="text-2xl font-bold text-amber-600">{plan.updates.length}</div>
              <div className="text-xs text-stone-500">güncellenecek</div>
            </div>
            <div className="rounded-xl bg-white p-2">
              <div className={`text-2xl font-bold ${plan.errors.length ? "text-red-600" : "text-stone-400"}`}>{plan.errors.length}</div>
              <div className="text-xs text-stone-500">hatalı</div>
            </div>
          </div>
          {plan.unchanged > 0 && <p className="text-xs text-stone-500">{plan.unchanged} ürün zaten aynı, dokunulmayacak.</p>}

          {plan.updates.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Değişecekler</summary>
              <ul className="mt-1 max-h-48 overflow-y-auto text-stone-600">
                {plan.updates.slice(0, 200).map((u) => (
                  <li key={u.product.barcode} className="truncate">
                    {u.product.name}: {u.changes.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {plan.errors.length > 0 && (
            <details className="text-sm" open={total === 0}>
              <summary className="cursor-pointer font-medium text-red-700">Hatalı satırlar (atlanacak)</summary>
              <ul className="mt-1 max-h-48 overflow-y-auto text-red-700">
                {plan.errors.slice(0, 100).map((e, i) => (
                  <li key={i}>
                    Satır {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex gap-2">
            <button onClick={() => setPlan(null)} className="h-12 flex-1 rounded-xl bg-white font-semibold">
              Vazgeç
            </button>
            <button
              onClick={apply}
              disabled={total === 0}
              className="h-12 flex-1 rounded-xl bg-emerald-700 font-semibold text-white disabled:bg-stone-300"
            >
              {total} ürünü kaydet
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
