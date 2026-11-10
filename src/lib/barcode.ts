/** GS1 (EAN-8 / UPC-A / EAN-13) kontrol hanesi doğru mu? */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // Sağdan sola: kontrol hanesinin hemen solundaki hane ×3
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Okunan barkodu tek biçime getirir; Firestore doküman kimliği olarak kullanılır.
 * - Boşluklar atılır.
 * - 12 haneli UPC-A, önüne 0 eklenerek EAN-13 yapılır (el terminalleri ile kamera aynı kodu üretsin).
 * - Firestore kimliğinde sorun çıkaracak karakterler reddedilir.
 */
export function normalizeBarcode(raw: string): string | null {
  const code = raw.trim().replace(/\s+/g, "");
  if (code.length < 4 || code.length > 64) return null;
  if (!/^[0-9A-Za-z\-.+]+$/.test(code)) return null;
  if (/^\d{12}$/.test(code) && hasValidCheckDigit(code)) return "0" + code;
  return code;
}

/** Sayısal ve GS1 uzunluğundaysa kontrol hanesi de tutmalı (yanlış okumaları eler). */
export function isPlausibleBarcode(code: string): boolean {
  if (/^\d+$/.test(code) && [8, 12, 13].includes(code.length)) return hasValidCheckDigit(code);
  return code.length >= 4;
}
