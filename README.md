# DNZ Bakkal

Bakkal için barkodlu fiyat takip uygulaması (PWA). Telefonla barkod okut → fiyatı gör; "Fiyat Değiştir" modunda okut → yeni fiyatı yaz → kaydet. Kayıtlı olmayan ürünün adı otomatik bulunur ve internette fiyatı aranabilir.

- Vite + React + TypeScript + Tailwind, `vite-plugin-pwa`
- Firebase Auth + Firestore (ücretsiz Spark planı; Cloud Functions / Storage kullanılmaz)
- Barkod: Android'de tarayıcının kendi okuyucusu, iPhone'da ZXing (WebAssembly). USB/Bluetooth barkod tabancası da çalışır.
- Çevrimdışı çalışır; internet gelince eşitlenir.
- **Giriş yapan kullanıcı asla kendiliğinden çıkış yaptırılmaz** (bkz. `src/lib/firebase.ts`). Tek çıkış yeri: Ayarlar → Çıkış yap.

## Yerelde çalıştırma (Firebase projesi olmadan)

Emulator için Java 21+ gerekir.

```bash
npm install
npm run emulators   # ayrı terminalde: Auth + Firestore emulator
npm run dev         # http://localhost:5173
```

`.env.local` yoksa uygulama otomatik olarak emulator'a (`demo-dnz`) bağlanır.

## Testler

```bash
npm test            # para / barkod mantığı
npm run test:rules  # Firestore güvenlik kuralları (emulator içinde)
```

## Firebase'e yayınlama

1. Firebase konsolunda proje aç. Authentication → Sign-in method: **E-posta/Şifre**'yi aç (giriş sadece e-posta ile). Firestore'u **eur3 (Avrupa)** bölgesinde oluştur.
2. Proje ayarları → Web uygulaması ekle → çıkan değerleri `.env.example`'dan kopyaladığın `.env.local`'a yaz. `VITE_FB_AUTH_DOMAIN` = `<proje-id>.web.app`.
3. `.firebaserc` içine proje kimliğini yaz (`firebase use --add`).
4. `npm run deploy` (derler, kuralları ve siteyi yükler).

iPhone'da Safari → Paylaş → **Ana Ekrana Ekle** ile kurulmalı (hem tam ekran hem kalıcı oturum için).
