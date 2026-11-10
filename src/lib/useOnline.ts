import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** "az önce", "5 dk önce", "3 saat önce", "2 gün önce", sonra tarih. */
export function timeAgo(date: Date | null | undefined): string {
  if (!date) return "";
  const s = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (s < 60) return "az önce";
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} saat önce`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} gün önce`;
  return date.toLocaleDateString("tr-TR");
}
