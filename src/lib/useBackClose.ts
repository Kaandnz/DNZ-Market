import { useEffect, useRef } from "react";

/**
 * Açık bir pencere/ekran varken telefonun "geri" tuşu uygulamadan çıkmasın,
 * sadece en üstteki pencereyi kapatsın.
 *
 * Açık pencereler bir yığında tutulur; yığın boş değilken tarayıcı geçmişinde
 * tek bir "koruma" kaydı bulunur. Geri tuşu bu kaydı tüketir, en üstteki pencere
 * kapanır ve hâlâ açık pencere varsa koruma yeniden eklenir.
 */
type Closer = () => void;

const stack: Closer[] = [];
let guard = false;
let ignorePops = 0;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    guard = false;
    const top = stack.pop();
    top?.();
    if (stack.length > 0) {
      history.pushState({ dnzGuard: true }, "");
      guard = true;
    }
  });
}

function push(c: Closer) {
  stack.push(c);
  if (!guard) {
    history.pushState({ dnzGuard: true }, "");
    guard = true;
  }
}

function remove(c: Closer) {
  const i = stack.indexOf(c);
  if (i < 0) return; // geri tuşuyla zaten kapandı
  stack.splice(i, 1);
  // Aynı anda başka bir pencere açılıyor olabilir (menü → ekran); bir sonraki adımda bak.
  queueMicrotask(() => {
    if (stack.length === 0 && guard) {
      guard = false;
      ignorePops++;
      history.back();
    }
  });
}

export function useBackClose(open: boolean, onClose: () => void) {
  const cb = useRef(onClose);
  cb.current = onClose;

  useEffect(() => {
    if (!open) return;
    const closer: Closer = () => cb.current();
    push(closer);
    return () => remove(closer);
  }, [open]);
}
