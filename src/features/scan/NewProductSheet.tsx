import { useEffect, useState } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import { FieldPad, type PadField } from "../../ui/FieldPad";
import { MarginLine, PriceChip } from "../../ui/PriceHints";
import { MarginChips } from "../../ui/MarginChips";
import { formatPct, kurusToInput, parseTL, suggestSale } from "../../lib/money";
import { lookupName, searchLinks, type NameHit } from "../../lib/lookup";
import { toast } from "../../lib/events";
import { MicButton } from "../../ui/MicButton";
import type { StoreSettings } from "../../data/types";

export interface NewProductResult {
  name: string;
  salePrice: number;
  costPrice?: number;
  qty?: number;
  /** İnternetten bulunan marka (varsa). */
  brand?: string;
  shareToCatalog: boolean;
}

interface Props {
  barcode: string | null;
  /** Bu kişi ürün ekleyebilir mi? Değilse sadece internette arama gösterilir. */
  canEdit: boolean;
  settings: StoreSettings;
  /** Alış / kâr bu telefonda gizli (Mal Kabul'de yine gösterilir) */
  hideCost?: boolean;
  /** Mal Kabul modunda gelen adet de sorulur. */
  withQty?: boolean;
  /** Stok takibi kapalıysa Mal Kabul'de "Adet" sorulmaz. */
  withStock?: boolean;
  offline?: boolean;
  onClose: () => void;
  onSave: (p: NewProductResult) => void;
}

/** Kayıtlı olmayan barkod: adı bul, internette fiyat ara, fiyat yazıp kaydet. */
export function NewProductSheet({ barcode, canEdit, settings, hideCost = false, withQty, withStock = true, offline, onClose, onSave }: Props) {
  const showCost = withQty || !hideCost;
  const [name, setName] = useState("");
  const [hit, setHit] = useState<NameHit | null>(null);
  const [looking, setLooking] = useState(false);
  const [value, setValue] = useState("");
  const [cost, setCost] = useState("");
  const [qty, setQty] = useState("");
  const [margin, setMargin] = useState("");
  const [active, setActive] = useState("sale");

  useEffect(() => {
    setName("");
    setHit(null);
    setValue("");
    setCost("");
    setQty("");
    setMargin("");
    setActive(withQty ? "cost" : "sale");
    if (!barcode) return;
    let cancelled = false;
    setLooking(true);
    lookupName(barcode)
      .then((h) => {
        if (cancelled) return;
        setHit(h);
        if (h) setName((current) => current || h.name);
      })
      .finally(() => !cancelled && setLooking(false));
    return () => {
      cancelled = true;
    };
  }, [barcode, withQty]);

  const costK = cost ? parseTL(cost) : null;
  const qtyN = qty ? Number(qty) : 0;
  const typedMargin = margin !== "" ? Number(margin) : null;
  const usedMargin = typedMargin ?? settings.defaultMarginPct;
  const suggestion = costK ? suggestSale(costK, usedMargin, settings.rounding) : null;
  // Mal Kabul'de satış yazılmadıysa, alış + kâr %'den önerilen fiyat kullanılır.
  const autoSale = withQty && !value && suggestion !== null;
  const kurus = autoSale ? suggestion : parseTL(value);
  const canSave = canEdit && name.trim().length > 0 && kurus !== null && kurus > 0 && (!cost || costK !== null);

  const fields: PadField[] = withQty
    ? [
        ...(withStock ? [{ key: "qty", label: "Adet", value: qty, placeholder: "0", kind: "qty" as const }] : []),
        { key: "cost", label: "Alış", value: cost, placeholder: "—" },
        {
          key: "margin",
          label: "Kâr",
          value: margin,
          placeholder: String(settings.defaultMarginPct),
          kind: "pct",
          note: typedMargin !== null ? "senin" : "varsayılan",
        },
        { key: "sale", label: "Satış", value, placeholder: autoSale ? kurusToInput(suggestion!) : "0", suggested: autoSale },
      ]
    : [
        { key: "cost", label: "Alış", value: cost, placeholder: "—", note: "isteğe bağlı" },
        { key: "sale", label: "Satış", value, placeholder: "0" },
      ].filter((f) => showCost || f.key !== "cost");

  function save() {
    if (!canSave || kurus === null) return;
    onSave({
      name: name.trim(),
      salePrice: kurus,
      ...(costK !== null ? { costPrice: costK } : {}),
      ...(qtyN > 0 ? { qty: qtyN } : {}),
      ...(hit?.brand ? { brand: hit.brand } : {}),
      // İsim ortak havuzda yoksa (veya kullanıcı düzelttiyse) havuza ekle; diğer marketler de faydalansın.
      shareToCatalog: hit?.source !== "catalog" || hit.name !== name.trim(),
    });
  }

  async function openLink(url: string, copyName?: boolean) {
    if (copyName && name.trim()) {
      try {
        await navigator.clipboard.writeText(name.trim());
        toast("Ürün adı kopyalandı, arama kutusuna yapıştırabilirsin.", "info");
      } catch {
        /* pano izni yoksa önemli değil */
      }
    }
    window.open(url, "_blank", "noopener");
  }

  return (
    <BottomSheet
      open={!!barcode}
      onClose={onClose}
      title={
        <>
          <div>Bu ürün kayıtlı değil</div>
          <div className="text-sm font-normal text-stone-500">{barcode}</div>
        </>
      }
    >
      {barcode && (
        <div className="flex flex-col gap-4">
          {offline && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-800">
              İnternet yok. Ürün başka cihazda eklenmiş olabilir; yine de buradan ekleyebilirsin.
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">Ürün adı</label>
            <div className="relative">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder={looking ? "İnternette aranıyor…" : "Ör. Ülker Çikolatalı Gofret 36 g"}
                className="h-14 w-full rounded-2xl border border-stone-300 pr-12 pl-4 text-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
              <MicButton onText={setName} className="absolute top-1/2 right-2 -translate-y-1/2" />
            </div>
            {hit && name === hit.name && (
              <p className="mt-1 text-xs text-stone-400">
                Ad otomatik bulundu ({hit.source === "catalog" ? "ortak liste" : "Open Food Facts"}). Gerekirse düzelt.
              </p>
            )}
            {!looking && !hit && <p className="mt-1 text-xs text-stone-400">Ad bulunamadı, elle yaz.</p>}
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-stone-600">İnternette fiyatına bak</div>
            <div className="grid grid-cols-2 gap-2">
              {searchLinks(barcode, name).map((l) => (
                <button
                  key={l.label}
                  onClick={() => openLink(l.url, l.copyName)}
                  className="h-12 rounded-2xl border border-stone-300 bg-white font-medium text-stone-700 active:bg-stone-100"
                >
                  {l.label} ↗
                </button>
              ))}
            </div>
          </div>

          {canEdit ? (
            <>
              <FieldPad
                fields={fields}
                active={active}
                onActive={setActive}
                onChange={(k, v) => {
                  if (k === "qty") setQty(v);
                  else if (k === "cost") setCost(v);
                  else if (k === "margin") {
                    setMargin(v);
                    setValue("");
                  } else setValue(v);
                }}
                onEnter={save}
              />
              {withQty && (
                <MarginChips
                  value={typedMargin}
                  onPick={(m) => {
                    setMargin(String(m));
                    setValue("");
                  }}
                />
              )}
              {showCost && <MarginLine sale={kurus} cost={costK} />}
              {showCost && suggestion !== null && suggestion !== kurus && (
                <PriceChip
                  label={`Önerilen satış (${formatPct(usedMargin)} kâr)`}
                  price={suggestion}
                  onClick={() => {
                    setValue(kurusToInput(suggestion));
                    setActive("sale");
                  }}
                />
              )}
              <button
                onClick={save}
                disabled={!canSave}
                className="h-16 rounded-2xl bg-emerald-700 text-xl font-bold text-white active:bg-emerald-800 disabled:bg-stone-300"
              >
                {!name.trim() ? "Önce ürün adını yaz" : "Ürünü kaydet"}
              </button>
            </>
          ) : (
            <p className="rounded-xl bg-stone-100 px-4 py-3 text-stone-600">
              Ürün eklemek için market sahibinin sana fiyat değiştirme yetkisi vermesi gerekir.
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
