import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Yeni sürüm sessizce yüklenir. Oturum IndexedDB'de durduğu için güncelleme kimseyi çıkış yaptırmaz.
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "DNZ Bakkal",
        short_name: "DNZ Bakkal",
        description: "Barkod okut, fiyatı gör, fiyatı değiştir.",
        lang: "tr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f5f5f4",
        theme_color: "#047857",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,wasm}"],
        // zxing barkod okuyucu wasm dosyası ~1 MB; çevrimdışı çalışsın diye önbelleğe alınır
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Firebase Auth'un /__/auth/ sayfaları SPA'ya yönlendirilmemeli
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "dev"),
  },
  server: { host: true },
});
