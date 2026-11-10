import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";

// Yeni sürüm arka planda yüklenir; oturum IndexedDB'de durduğu için kimse çıkış yapmaz.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
