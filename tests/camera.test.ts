import { describe, expect, it } from "vitest";
import { mainAndroidCamera } from "../src/scanner/camera";

const cam = (label: string) => ({ deviceId: label, label });

describe("Android ana kamera seçimi", () => {
  it("'camera 2' yerine 'camera 0' seçilir (boşluklu ad)", () => {
    const cams = [cam("camera 2, facing back"), cam("camera 0, facing back"), cam("camera 3, facing back")];
    expect(mainAndroidCamera(cams)?.label).toBe("camera 0, facing back");
  });

  it("'camera2 0' biçimi de tanınır", () => {
    const cams = [cam("camera2 4, facing back"), cam("camera2 0, facing back")];
    expect(mainAndroidCamera(cams)?.label).toBe("camera2 0, facing back");
  });

  it("ön kamera seçilmez", () => {
    const cams = [cam("camera 1, facing front"), cam("camera 2, facing back")];
    expect(mainAndroidCamera(cams)?.label).toBe("camera 2, facing back");
  });

  it("tanınmayan adlarda seçim yapılmaz", () => {
    expect(mainAndroidCamera([cam("Back Camera")])).toBeUndefined();
  });
});
