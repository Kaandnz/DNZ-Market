import { useState, type ReactNode } from "react";
import { ScanScreen } from "./scan/ScanScreen";
import { MembersScreen } from "./store/MembersScreen";
import { SettingsScreen } from "./settings/SettingsScreen";
import { ProductsScreen } from "./products/ProductsScreen";
import { HistoryScreen } from "./history/HistoryScreen";
import { StockScreen } from "./stock/StockScreen";
import { BulkScreen } from "./bulk/BulkScreen";
import { LabelsScreen } from "./labels/LabelsScreen";
import { useActiveStore } from "./store/StoreProvider";
import { useUser } from "./auth/AuthProvider";
import { useBackClose } from "../lib/useBackClose";
import { useOnline } from "../lib/useOnline";

type Screen = "scan" | "products" | "labels" | "stock" | "bulk" | "history" | "members" | "settings";

const TITLES: Record<Exclude<Screen, "scan">, string> = {
  products: "Ürünler",
  labels: "Raf etiketleri",
  stock: "Stok",
  bulk: "Toplu zam",
  history: "Fiyat geçmişi",
  members: "Market ve kişiler",
  settings: "Ayarlar",
};

/** Ana ekran sade: sadece tarama. Diğer her şey sol menüde. */
export function Shell() {
  const { store, canEdit } = useActiveStore();
  const user = useUser();
  const online = useOnline();
  const [screen, setScreen] = useState<Screen>("scan");
  const [menu, setMenu] = useState(false);
  const [countMode, setCountMode] = useState(false);
  /** Ana ekrandaki kutuya isim yazılınca Ürünler bu aramayla açılır. */
  const [productSearch, setProductSearch] = useState({ text: "", n: 0 });

  useBackClose(menu, () => setMenu(false));
  useBackClose(screen !== "scan", () => setScreen("scan"));

  function go(s: Screen) {
    setMenu(false);
    if (s === "products") setProductSearch((p) => ({ text: "", n: p.n + 1 }));
    setScreen(s);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="mb-3 flex items-center gap-2">
        {screen === "scan" ? (
          <button onClick={() => setMenu(true)} className="grid size-12 place-items-center rounded-2xl text-2xl active:bg-stone-200" aria-label="Menü">
            ☰
          </button>
        ) : (
          <button onClick={() => setScreen("scan")} className="grid size-12 place-items-center rounded-2xl text-2xl active:bg-stone-200" aria-label="Geri">
            ←
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{screen === "scan" ? store.name : TITLES[screen]}</h1>
        {!online && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">Çevrimdışı</span>}
      </header>

      <main className="flex-1">
        {/* Tarama ekranı alt ekranlar açıkken de yaşar ki kamera tekrar izin istemesin. */}
        <div className={screen === "scan" ? "" : "hidden"}>
          <ScanScreen
            blocked={screen !== "scan" || menu}
            countMode={countMode}
            onExitCount={() => {
              setCountMode(false);
              setScreen("stock");
            }}
            onSearchName={(text) => {
              setProductSearch((p) => ({ text, n: p.n + 1 }));
              setScreen("products");
            }}
          />
        </div>
        {screen === "products" && <ProductsScreen key={productSearch.n} initialSearch={productSearch.text} />}
        {screen === "history" && <HistoryScreen />}
        {screen === "stock" && (
          <StockScreen
            onStartCount={() => {
              setCountMode(true);
              setScreen("scan");
            }}
          />
        )}
        {screen === "bulk" && <BulkScreen />}
        {screen === "labels" && <LabelsScreen />}
        {screen === "members" && <MembersScreen />}
        {screen === "settings" && <SettingsScreen />}
      </main>

      {menu && (
        <div className="fixed inset-0 z-40">
          <button className="absolute inset-0 bg-black/40 animate-[fade_.15s_ease-out]" onClick={() => setMenu(false)} aria-label="Menüyü kapat" />
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl animate-[left_.2s_ease-out]">
            <div className="px-5 pb-4">
              <div className="text-lg font-bold">{store.name}</div>
              <div className="truncate text-sm text-stone-500">{user.displayName || user.email}</div>
            </div>
            <MenuItem icon="📦" onClick={() => go("products")}>
              Ürünler
            </MenuItem>
            {canEdit && (
              <>
                <MenuItem icon="🏷" onClick={() => go("labels")}>
                  Raf etiketleri
                </MenuItem>
                {store.settings.stockEnabled && (
                  <MenuItem icon="📊" onClick={() => go("stock")}>
                    Stok
                  </MenuItem>
                )}
                <MenuItem icon="💹" onClick={() => go("bulk")}>
                  Toplu zam
                </MenuItem>
                <MenuItem icon="🕘" onClick={() => go("history")}>
                  Fiyat geçmişi
                </MenuItem>
              </>
            )}
            <MenuItem icon="🏪" onClick={() => go("members")}>
              Market ve kişiler
            </MenuItem>
            <MenuItem icon="⚙️" onClick={() => go("settings")}>
              Ayarlar
            </MenuItem>
          </nav>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick }: { icon: string; children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 px-5 py-4 text-left text-lg active:bg-stone-100">
      <span className="text-2xl">{icon}</span>
      {children}
    </button>
  );
}
