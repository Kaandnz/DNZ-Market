import { storage } from "../lib/feedback";
import { isIOS } from "../lib/platform";

// v2: eski sürüm Android'de yanlış (geniş açı/makro) kamerayı kaydedebiliyordu; herkes otomatiğe döner.
const CAM_KEY = "dnz.camId.v2";
/** Kullanıcı Ayarlar'dan kendisi seçtiyse otomatik seçim onu ezmesin. */
const CAM_MANUAL_KEY = "dnz.camManual.v2";
const ZOOM_KEY = "dnz.zoom";
export const CAMERA_CHANGED_EVENT = "dnz-camera-changed";

/** 1080p iste: telefon dik tutulunca görüntü 1080 piksel genişliğinde olur, ekranda net görünür. */
const BASE: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 },
};

function gum(video: MediaTrackConstraints) {
  return navigator.mediaDevices.getUserMedia({ video, audio: false });
}

function stop(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop());
}

export interface CameraOption {
  deviceId: string;
  label: string;
}

/** Arka kameralar (izin verildikten sonra adları görünür). */
export async function listCameras(): Promise<CameraOption[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput" && d.deviceId)
    .filter((d) => !/front|ön|user|facetime/i.test(d.label))
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Kamera ${i + 1}` }));
}

/**
 * Yakından barkod okumak için en iyi arka kamera:
 * - iPhone Pro'larda ana lens ~20 cm'den yakına odaklanamaz. "Üçlü" / "Çift Geniş" sanal
 *   kamera, iPhone'un kendi Kamera uygulaması gibi yakında makro lense kendiliğinden geçer.
 * - Android'de çok kameralı telefonlarda ana kamera "camera2 0, facing back"tır.
 */
function pickBest(cams: CameraOption[]): CameraOption | undefined {
  const find = (re: RegExp) => cams.find((c) => re.test(c.label));
  if (isIOS()) {
    return find(/triple|üçlü/i) ?? find(/dual wide|çift geniş|geniş açılı çift/i);
  }
  return mainAndroidCamera(cams);
}

/**
 * Android'de kameralar "camera 0, facing back" / "camera2 0, facing back" diye adlandırılır.
 * Ana arka kamera en düşük numaralı olandır. Chrome "arka kamera" deyince çoğu zaman
 * sondakini (geniş açı / makro / derinlik) seçer; görüntü çamur gibi olur.
 */
export function mainAndroidCamera(cams: CameraOption[]): CameraOption | undefined {
  let best: { cam: CameraOption; n: number } | undefined;
  for (const cam of cams) {
    const m = /camera2?\s*(\d+)\s*,\s*facing back/i.exec(cam.label);
    if (!m) continue;
    const n = Number(m[1]);
    if (!best || n < best.n) best = { cam, n };
  }
  return best?.cam;
}

export function getSavedCamera(): string | null {
  return storage.get(CAM_KEY) || null;
}

/** Ayarlar'dan elle kamera seçimi. Boş değer = otomatik. */
export function chooseCamera(deviceId: string | null) {
  storage.set(CAM_KEY, deviceId ?? "");
  storage.set(CAM_MANUAL_KEY, deviceId ? "1" : "");
  window.dispatchEvent(new Event(CAMERA_CHANGED_EVENT));
}

/** Akışın gerçek çözünürlüğü (dik tutulsa da uzun kenar). */
function longSide(stream: MediaStream): number {
  const s = stream.getVideoTracks()[0]?.getSettings() ?? {};
  return Math.max(s.width ?? 0, s.height ?? 0);
}

/**
 * Bazı Android'lerde "ideal" 1080p istense de tarayıcı 640×480 verir ve görüntü çamur gibi olur.
 * Düşük gelirse aynı kamerayı en az 720p şartıyla yeniden aç.
 */
async function ensureResolution(stream: MediaStream): Promise<MediaStream> {
  if (longSide(stream) >= 1280) return stream;
  const deviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
  if (!deviceId) return stream;
  for (const [w, h] of [
    [1920, 1080],
    [1280, 720],
  ]) {
    try {
      const next = await gum({ deviceId: { exact: deviceId }, width: { min: w }, height: { min: h }, frameRate: { ideal: 30 } });
      stop(stream);
      return next;
    } catch {
      /* bu çözünürlüğü desteklemiyor, bir alttakini dene */
    }
  }
  return stream;
}

export async function openBackCamera(): Promise<MediaStream> {
  return ensureResolution(await openBestCamera());
}

async function openBestCamera(): Promise<MediaStream> {
  const saved = getSavedCamera();
  if (saved) {
    try {
      return await gum({ ...BASE, deviceId: { exact: saved } });
    } catch {
      storage.set(CAM_KEY, "");
      storage.set(CAM_MANUAL_KEY, "");
    }
  }

  const stream = await gum({ ...BASE, facingMode: { ideal: "environment" } });
  if (storage.get(CAM_MANUAL_KEY)) return stream;

  try {
    const best = pickBest(await listCameras());
    const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
    if (best && best.deviceId !== current) {
      stop(stream);
      const better = await gum({ ...BASE, deviceId: { exact: best.deviceId } });
      storage.set(CAM_KEY, best.deviceId);
      return better;
    }
    if (best) storage.set(CAM_KEY, best.deviceId);
  } catch {
    /* seçilemezse ilk açılan kamera ile devam */
  }
  return stream;
}

type Caps = MediaTrackCapabilities & {
  focusMode?: string[];
  zoom?: { min: number; max: number; step?: number };
  torch?: boolean;
};

export interface TrackInfo {
  torch: boolean;
  /** Bu kamerada seçilebilecek yakınlaştırma seviyeleri (desteklenmiyorsa boş). */
  zoomLevels: number[];
  zoom: number;
  /** Dokunarak odaklama destekleniyor mu? */
  tapFocus: boolean;
}

function readCaps(track: MediaStreamTrack): Caps {
  try {
    return (track.getCapabilities?.() ?? {}) as Caps;
  } catch {
    return {};
  }
}

/** Ayarlar ekranında gösterilen anlık kamera bilgisi (sorun ararken). */
export interface CameraDiag {
  label: string;
  width: number;
  height: number;
  fps: number;
  focusMode: string;
  focusModes: string[];
  zoom: number;
  zoomMax: number;
}
let lastDiag: CameraDiag | null = null;
export const getCameraDiag = () => lastDiag;

function updateDiag(track: MediaStreamTrack, caps: Caps) {
  const s = track.getSettings() as MediaTrackSettings & { focusMode?: string; zoom?: number };
  lastDiag = {
    label: track.label,
    width: s.width ?? 0,
    height: s.height ?? 0,
    fps: Math.round(s.frameRate ?? 0),
    focusMode: s.focusMode ?? "—",
    focusModes: caps.focusMode ?? [],
    zoom: s.zoom ?? 1,
    zoomMax: caps.zoom?.max ?? 1,
  };
}

/** Sürekli odak açar, kayıtlı yakınlaştırmayı uygular; kameranın neleri desteklediğini döner. */
export async function tuneTrack(track: MediaStreamTrack): Promise<TrackInfo> {
  const caps = readCaps(track);
  try {
    updateDiag(track, caps);
  } catch {
    /* bilgi okunamadı */
  }

  if (caps.focusMode?.includes("continuous")) {
    await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
  }

  const zoomLevels =
    caps.zoom && caps.zoom.max > caps.zoom.min
      ? [1, 1.5, 2].filter((z) => z >= caps.zoom!.min && z <= caps.zoom!.max)
      : [];

  let zoom = 1;
  const savedZoom = Number(storage.get(ZOOM_KEY));
  if (zoomLevels.includes(savedZoom) && savedZoom !== 1) {
    zoom = (await setZoom(track, savedZoom)) ? savedZoom : 1;
  }

  const tapFocus = !!caps.focusMode?.some((m) => m === "single-shot" || m === "continuous");
  try {
    updateDiag(track, caps);
  } catch {
    /* bilgi okunamadı */
  }
  return { torch: !!caps.torch, zoomLevels, zoom, tapFocus };
}

export async function setZoom(track: MediaStreamTrack, zoom: number): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] });
    storage.set(ZOOM_KEY, String(zoom));
    if (lastDiag) lastDiag = { ...lastDiag, zoom };
    return true;
  } catch {
    return false;
  }
}

/**
 * Dokunulan noktaya odaklan (x, y: 0–1 arası). Önce o noktaya tek seferlik odak,
 * sonra tekrar sürekli odak. Desteklemeyen tarayıcıda sessizce hiçbir şey yapmaz.
 */
export async function focusAt(track: MediaStreamTrack, x: number, y: number): Promise<void> {
  const caps = readCaps(track);
  const modes = caps.focusMode ?? [];
  const point = { pointsOfInterest: [{ x, y }] };
  try {
    if (modes.includes("single-shot")) {
      await track.applyConstraints({ advanced: [{ ...point, focusMode: "single-shot" } as MediaTrackConstraintSet] });
    } else if (modes.includes("manual") && modes.includes("continuous")) {
      // Bazı Android'ler: modu değiştirmek odağı yeniden tetikler.
      await track.applyConstraints({ advanced: [{ focusMode: "manual" } as MediaTrackConstraintSet] });
    }
    if (modes.includes("continuous")) {
      setTimeout(() => {
        track.applyConstraints({ advanced: [{ ...point, focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
      }, 800);
    }
  } catch {
    /* desteklenmiyor */
  }
}
