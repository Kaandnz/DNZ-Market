/** Basit uygulama içi bildirim (toast) kanalı. */
export type ToastKind = "ok" | "error" | "info";
export interface ToastMsg {
  id: number;
  kind: ToastKind;
  text: string;
}

type Listener = (t: ToastMsg) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function toast(text: string, kind: ToastKind = "ok") {
  const msg = { id: nextId++, kind, text };
  listeners.forEach((l) => l(msg));
}

export function onToast(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Firebase hatalarını Türkçe, anlaşılır cümleye çevirir. Asla oturum kapatmaz. */
export function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "permission-denied": "Bu işlem için yetkin yok.",
    unavailable: "İnternet yok. İşlem kaydedildi, bağlantı gelince gönderilecek.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/wrong-password": "E-posta veya şifre hatalı.",
    "auth/user-not-found": "Bu e-postayla kayıtlı hesap yok.",
    "auth/email-already-in-use": "Bu e-posta zaten kayıtlı. Giriş yap'ı dene.",
    "auth/weak-password": "Şifre en az 6 karakter olmalı.",
    "auth/invalid-email": "E-posta adresi geçersiz.",
    "auth/network-request-failed": "İnternet bağlantısı yok.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı, biraz sonra tekrar dene.",
  };
  if (map[code]) return map[code];
  if (e instanceof Error && e.message && !code) return e.message;
  return "Bir hata oluştu" + (code ? ` (${code})` : "") + ".";
}
