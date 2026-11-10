import { useEffect, useState } from "react";
import { chooseCamera, getCameraDiag, getSavedCamera, listCameras, type CameraOption } from "../../scanner/camera";

/**
 * Otomatik seçilen kamera iyi değilse elle seçmek için + kameranın gerçekte ne verdiğini gösterir
 * (çözünürlük, odak modu, yakınlaştırma). Görüntü bulanıksa sebebini buradan anlarız.
 */
export function CameraPicker() {
  const [cams, setCams] = useState<CameraOption[] | null>(null);
  const [selected, setSelected] = useState<string>(() => getSavedCamera() ?? "");
  const [diag, setDiag] = useState(getCameraDiag);

  useEffect(() => {
    listCameras()
      .then(setCams)
      .catch(() => setCams([]));
    const t = setInterval(() => setDiag(getCameraDiag()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      {cams && cams.length > 1 && (
        <>
          <label className="mb-1 block">Kamera</label>
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              chooseCamera(e.target.value || null);
            }}
            className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base"
          >
            <option value="">Otomatik</option>
            {cams.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-stone-500">
            Görüntü bulanıksa başka kamera dene. iPhone'da "Üçlü" / "Çift Geniş", Android'de genelde "camera 0" (ana kamera) en iyisidir.
          </p>
        </>
      )}

      {diag && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-stone-50 p-3 font-mono text-xs text-stone-600">
          <dt>Kamera</dt>
          <dd className="break-all">{diag.label || "—"}</dd>
          <dt>Görüntü</dt>
          <dd className={Math.max(diag.width, diag.height) < 1280 ? "font-bold text-red-600" : ""}>
            {diag.width}×{diag.height} · {diag.fps} fps
          </dd>
          <dt>Odak</dt>
          <dd>
            {diag.focusMode}
            {diag.focusModes.length > 0 && ` (${diag.focusModes.join(", ")})`}
          </dd>
          <dt>Zoom</dt>
          <dd className={diag.zoom > 1 ? "font-bold text-amber-700" : ""}>
            {diag.zoom}x / en fazla {diag.zoomMax}x
          </dd>
        </dl>
      )}
    </div>
  );
}
