/** Tüm fiyatlar kuruş cinsinden tam sayı olarak tutulur (12,50 ₺ → 1250). */

const tlFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plainFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const MAX_PRICE_KURUS = 100_000_000; // 1.000.000 ₺

export function formatTL(kurus: number): string {
  return tlFormatter.format(kurus / 100);
}

export function formatPlain(kurus: number): string {
  return plainFormatter.format(kurus / 100);
}

/**
 * Kullanıcının yazdığı fiyatı kuruşa çevirir. "12,50", "12.5", "1.250,00", "₺ 7" gibi
 * yazımları kabul eder. Geçersizse null döner.
 */
export function parseTL(input: string): number | null {
  const s = input.trim().replace(/\s|₺|tl/gi, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let dec = -1;
  if (lastComma >= 0 && lastDot >= 0) {
    dec = Math.max(lastComma, lastDot);
  } else if (lastComma >= 0) {
    dec = s.indexOf(",") === lastComma ? lastComma : -1;
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    // "1.250" veya "1.250.000" → binlik ayırıcı; "12.5" → ondalık
    const thousands = parts.length > 2 || parts[parts.length - 1].length === 3;
    dec = thousands ? -1 : lastDot;
  }

  const intRaw = dec >= 0 ? s.slice(0, dec) : s;
  const frac = dec >= 0 ? s.slice(dec + 1) : "";
  // Tam kısımda ayırıcı varsa sadece düzgün binlik gruplar kabul edilir (1.250.000); "1,2,3" geçersiz.
  if (/[.,]/.test(intRaw) && !/^\d{1,3}([.,]\d{3})+$/.test(intRaw)) return null;
  const int = intRaw.replace(/[.,]/g, "");
  if (!/^\d*$/.test(int) || !/^\d*$/.test(frac)) return null;
  if (frac.length > 2 || (int === "" && frac === "")) return null;

  const kurus = Number(int || "0") * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(kurus) || kurus > MAX_PRICE_KURUS) return null;
  return kurus;
}

/**
 * Sayısal tuş takımına basılan tuşu fiyat metnine uygular.
 * Metin "12,5" biçimindedir: en fazla 7 tam hane, tek virgül, en fazla 2 ondalık.
 */
export function applyKey(current: string, key: string): string {
  if (key === "back") return current.slice(0, -1);
  if (key === "clear") return "";
  const [int, frac] = current.split(",");
  if (key === ",") {
    if (current.includes(",")) return current;
    return (current || "0") + ",";
  }
  if (!/^\d+$/.test(key)) return current;
  if (frac !== undefined) {
    const room = 2 - frac.length;
    return room > 0 ? current + key.slice(0, room) : current;
  }
  const nextInt = (int === "0" ? "" : int) + key;
  const trimmed = nextInt.replace(/^0+(?=\d)/, "");
  return trimmed.length > 7 ? current : trimmed;
}

/** Kuruşu tuş takımı metnine çevirir: 125050 → "1250,50". */
export function kurusToInput(kurus: number): string {
  return formatPlain(kurus).replace(/\./g, "");
}

/** Kâr yüzdesi (alışa göre). Alış yoksa null. */
export function marginPct(sale: number, cost: number | null | undefined): number | null {
  if (!cost || cost <= 0) return null;
  return ((sale - cost) / cost) * 100;
}

/** Adet tuş takımı: sadece rakam, en fazla 5 hane. */
export function applyQtyKey(current: string, key: string): string {
  if (key === "back") return current.slice(0, -1);
  if (key === "clear") return "";
  if (!/^\d$/.test(key)) return current;
  const next = (current === "0" ? "" : current) + key;
  return next.length > 5 ? current : next;
}

export type Rounding = "none" | "25" | "50" | "90" | "100";

export const ROUNDING_OPTIONS: { value: Rounding; label: string; example: string }[] = [
  { value: "none", label: "Yok", example: "12,34" },
  { value: "25", label: ",25", example: "12,50" },
  { value: "50", label: ",50", example: "12,50" },
  { value: "90", label: ",90", example: "12,90" },
  { value: "100", label: "Tam lira", example: "13,00" },
];

/** Fiyatı seçilen kurala göre YUKARI yuvarlar (kâr hiç düşmesin). */
export function roundPrice(kurus: number, rounding: Rounding): number {
  const k = Math.ceil(kurus - 1e-9);
  switch (rounding) {
    case "25":
      return Math.ceil(k / 25) * 25;
    case "50":
      return Math.ceil(k / 50) * 50;
    case "100":
      return Math.ceil(k / 100) * 100;
    case "90": {
      // 12,34 → 12,90 · 12,90 → 12,90 · 12,95 → 13,90
      let p = Math.floor(k / 100) * 100 + 90;
      if (p < k) p += 100;
      return p;
    }
    default:
      return k;
  }
}

/** Alış fiyatına kâr ekleyip yuvarlanmış satış fiyatı önerir. */
export function suggestSale(cost: number, margin: number, rounding: Rounding): number {
  return roundPrice(cost * (1 + margin / 100), rounding);
}

/** "%25" gibi gösterim; tam sayıya yakınsa ondalıksız. */
export function formatPct(p: number): string {
  const r = Math.round(p * 10) / 10;
  return "%" + (Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ","));
}
