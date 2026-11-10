import { BarcodeDetector as ZXingDetector, prepareZXingModule } from "barcode-detector/ponyfill";
// wasm dosyası uygulamayla birlikte sunulur: CDN'e bağlı kalmaz, çevrimdışı çalışır.
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
  },
});

/** Market ürünlerinde kullanılan barkod türleri. */
const FORMATS = ["ean_13", "ean_8", "upc_a", "code_128", "itf"] as const;

export interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
}

let cached: Promise<Detector> | null = null;

/**
 * Android Chrome'da tarayıcının kendi (hızlı) okuyucusu, iPhone Safari'de ve
 * diğerlerinde ZXing (WebAssembly) kullanılır.
 */
export function getDetector(): Promise<Detector> {
  cached ??= (async () => {
    const Native = (window as unknown as { BarcodeDetector?: typeof ZXingDetector }).BarcodeDetector;
    if (Native && Native !== ZXingDetector) {
      try {
        const supported = await Native.getSupportedFormats();
        if (supported.includes("ean_13")) {
          return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
        }
      } catch {
        /* ZXing'e düş */
      }
    }
    return new ZXingDetector({ formats: [...FORMATS] });
  })();
  return cached;
}
