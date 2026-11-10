import { useEffect, useRef, useState, type PointerEvent } from "react";
import { getDetector } from "./detector";
import { CAMERA_CHANGED_EVENT, focusAt, openBackCamera, setZoom as applyZoom, tuneTrack } from "./camera";
import { isPlausibleBarcode, normalizeBarcode } from "../lib/barcode";

interface Props {
  /** Pencere açıkken okuma durur (kamera açık kalır, tekrar izin sormasın diye). */
  paused: boolean;
  /**
   * Tarama ekranı görünmüyor (menü ya da başka ekran açık). Geri dönülünce aynı ürün
   * hemen tekrar okunabilsin diye "son okunan" unutulur.
   */
  hidden?: boolean;
  onDetected: (code: string) => void;
}

type CamError = "denied" | "notfound" | "insecure" | "other";

/** Aynı barkod kadrajda kaldıkça tekrar okunmaz; bu kadar süre kadrajdan çıkınca tekrar okunur. */
const SAME_CODE_COOLDOWN_MS = 1500;
const SCAN_INTERVAL_MS = 120;

export function Scanner({ paused, hidden = false, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const pausedRef = useRef(paused);
  const onDetectedRef = useRef(onDetected);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  pausedRef.current = paused;
  onDetectedRef.current = onDetected;

  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  const [error, setError] = useState<CamError | null>(null);
  const [starting, setStarting] = useState(true);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevels, setZoomLevels] = useState<number[]>([]);
  const [zoom, setZoom] = useState(1);
  const [tapFocus, setTapFocus] = useState(false);
  const [focusMark, setFocusMark] = useState<{ x: number; y: number; id: number } | null>(null);
  const [retry, setRetry] = useState(0);

  // Ayarlar'dan kamera değişince yeniden aç.
  useEffect(() => {
    const onChange = () => setRetry((r) => r + 1);
    window.addEventListener(CAMERA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CAMERA_CHANGED_EVENT, onChange);
  }, []);

  // Uygulama arka plana geçince kamerayı kapat (pil + gizlilik), dönünce aç.
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      setStarting(true);
      setError(null);
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("insecure");
        setStarting(false);
        return;
      }
      try {
        stream = await openBackCamera();
      } catch (e) {
        const name = (e as DOMException).name;
        setError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "notfound" : "other");
        setStarting(false);
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* iOS bazen ilk play'i reddeder; autoPlay + muted ile yine başlar */
      }
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const info = await tuneTrack(track);
      if (stopped) return;
      setTorchAvailable(info.torch);
      setZoomLevels(info.zoomLevels);
      setZoom(info.zoom);
      setTapFocus(info.tapFocus);
      setStarting(false);

      const detector = await getDetector();
      const tick = async () => {
        if (stopped) return;
        if (!pausedRef.current && video.readyState >= 2 && ctx) {
          try {
            // Sadece ortadaki şeridi oku: daha hızlı ve yanlışlıkla yandaki ürünü okumaz.
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const cw = Math.round(vw * 0.9);
            const ch = Math.round(vh * 0.6);
            // 1080p karede okuyucuyu yormamak için uzun kenarı en fazla 1280 piksele indir.
            const scale = Math.min(1, 1280 / Math.max(cw, ch));
            canvas.width = Math.round(cw * scale);
            canvas.height = Math.round(ch * scale);
            ctx.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
            const results = await detector.detect(canvas);
            for (const r of results) {
              const code = normalizeBarcode(r.rawValue);
              if (!code || !isPlausibleBarcode(code)) continue;
              const now = Date.now();
              if (code === lastRef.current.code && now - lastRef.current.at < SAME_CODE_COOLDOWN_MS) {
                lastRef.current.at = now;
                break;
              }
              lastRef.current = { code, at: now };
              if (!pausedRef.current) onDetectedRef.current(code);
              break;
            }
          } catch {
            /* tek kare hatası önemsiz */
          }
        }
        timer = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      void tick();
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
      setTorchOn(false);
    };
  }, [visible, retry]);

  // Pencere kapanınca kamera hâlâ aynı ürüne bakıyorsa onu hemen tekrar açmasın:
  // aynı barkod, kadrajdan 2,5 sn çıkmadan tekrar okunmaz.
  useEffect(() => {
    if (!paused) lastRef.current = { ...lastRef.current, at: Date.now() };
  }, [paused]);

  // Menüden / başka ekrandan dönünce: aynı ürün de hemen okunsun ve bip etsin.
  useEffect(() => {
    if (hidden) lastRef.current = { code: "", at: 0 };
  }, [hidden]);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setTorchAvailable(false);
    }
  }

  /** 1x → 1,5x → 2x: ürünü biraz uzakta tutunca kamera netleyebilir, barkod yine büyük görünür. */
  async function cycleZoom() {
    const track = trackRef.current;
    if (!track || zoomLevels.length < 2) return;
    const next = zoomLevels[(zoomLevels.indexOf(zoom) + 1) % zoomLevels.length];
    if (await applyZoom(track, next)) setZoom(next);
  }

  /** Görüntüye dokununca o noktaya odaklan. */
  function onTap(e: PointerEvent<HTMLVideoElement>) {
    const track = trackRef.current;
    if (!track) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setFocusMark({ x, y, id: Date.now() });
    setTimeout(() => setFocusMark(null), 900);
    void focusAt(track, x, y);
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-stone-900">
      <video ref={videoRef} className="size-full object-cover" playsInline muted autoPlay onPointerDown={onTap} />

      {focusMark && (
        <div
          key={focusMark.id}
          className="pointer-events-none absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400 animate-[fade_.15s_ease-out]"
          style={{ left: `${focusMark.x * 100}%`, top: `${focusMark.y * 100}%` }}
        />
      )}

      {!error && !starting && (
        <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-medium text-white/80 drop-shadow">
          Ürünü 15–20 cm uzakta tut{tapFocus ? " · bulanıksa ekrana dokun" : ""}
        </div>
      )}

      {!error && !starting && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={`relative h-[55%] w-[85%] rounded-2xl border-2 ${paused ? "border-white/30" : "border-white/80"}`}>
            {!paused && (
              <div className="absolute inset-x-3 top-1/2 h-0.5 rounded bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,.7)] animate-[scanline_1.6s_ease-in-out_infinite]" />
            )}
          </div>
        </div>
      )}

      {starting && !error && (
        <div className="absolute inset-0 grid place-items-center text-white/70">Kamera açılıyor…</div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <div className="text-4xl">📷</div>
          <p className="text-lg font-medium">
            {error === "denied" && "Kamera izni verilmedi."}
            {error === "notfound" && "Kamera bulunamadı."}
            {error === "insecure" && "Kamera için güvenli bağlantı (https) gerekir."}
            {error === "other" && "Kamera açılamadı."}
          </p>
          <p className="text-sm text-white/70">
            {error === "denied"
              ? "Tarayıcı ayarlarından bu siteye kamera izni ver. Bu arada barkodu aşağıya yazabilirsin."
              : "Barkod okuyucu tabanca bağlıysa direkt okutabilir ya da barkodu aşağıya yazabilirsin."}
          </p>
          {error !== "insecure" && (
            <button onClick={() => setRetry((r) => r + 1)} className="mt-1 rounded-full bg-white/15 px-5 py-2 font-medium active:bg-white/25">
              Tekrar dene
            </button>
          )}
        </div>
      )}

      {torchAvailable && !error && (
        <button
          onClick={toggleTorch}
          className={`absolute right-3 bottom-3 grid size-12 place-items-center rounded-full text-2xl ${torchOn ? "bg-amber-400" : "bg-black/50"}`}
          aria-label={torchOn ? "Feneri kapat" : "Feneri aç"}
        >
          🔦
        </button>
      )}

      {zoomLevels.length > 1 && !error && (
        <button
          onClick={cycleZoom}
          className="absolute bottom-3 left-3 grid h-12 min-w-12 place-items-center rounded-full bg-black/50 px-3 text-base font-bold text-white"
          aria-label="Yakınlaştır"
        >
          {String(zoom).replace(".", ",")}x
        </button>
      )}
    </div>
  );
}
