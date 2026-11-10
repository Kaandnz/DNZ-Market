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

## Yayın

Canlı adres: **https://dnzbarcode.web.app** (Firebase projesi `dnz-bakkal`, hosting sitesi `dnzbarcode`).
Eski adres `dnz-bakkal.web.app` yeni adrese yönlendirir (`hosting-redirect/`).

### Otomatik yayın (GitHub Actions)

`main`'e her push'ta `.github/workflows/deploy.yml` çalışır: tip kontrolü → birim testleri → güvenlik kuralı
testleri → derleme → Firebase'e yayın (site + Firestore kuralları + indeksler). Bir test bile kırılırsa yayın yapılmaz.

Bir kerelik kurulum (yapıldı): `npx firebase init hosting:github` servis hesabını (`github-action-1452407939`) oluşturup
GitHub'a `FIREBASE_SERVICE_ACCOUNT_DNZ_BAKKAL` secret'ı olarak ekledi. Kuralları da yayınlayabilmesi için bu hesaba
Google Cloud IAM'den **Firebase Admin** ve **Service Usage Consumer** rolleri verildi.

Elle kurmak gerekirse:

1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=dnz-bakkal → **Create service account**,
   ad: `github-deploy`. Roller: **Firebase Admin** ve **Service Usage Consumer**.
2. Oluşan hesaba gir → **Keys** → **Add key** → **Create new key** → **JSON** (dosya iner).
3. https://github.com/Kaandnz/DNZ-Market/settings/secrets/actions → **New repository secret**,
   ad: `FIREBASE_SERVICE_ACCOUNT_DNZ_BAKKAL`, değer: indirilen JSON dosyasının tüm içeriği. Sonra JSON dosyasını sil.

Secret yoksa testler yine çalışır, yayın adımı uyarıyla atlanır. Actions sekmesinden **Run workflow** ile elle de çalıştırılabilir.

### Elle yayın

`.env.production` Firebase web ayarlarını içerir (gizli değildir, sitenin koduna zaten gömülür).

```bash
npm run deploy
```

### Yeni bir Firebase projesine kurmak için

1. Firebase konsolunda proje aç. Authentication → Sign-in method: **E-posta/Şifre**'yi aç (giriş sadece e-posta ile). Firestore'u **eur3 (Avrupa)** bölgesinde oluştur.
2. Proje ayarları → Web uygulaması ekle → çıkan değerleri `.env.production`'a yaz.
3. `.firebaserc` ve `firebase.json` içindeki proje / site adlarını değiştir.

iPhone'da Safari → Paylaş → **Ana Ekrana Ekle** ile kurulmalı (hem tam ekran hem kalıcı oturum için).
