import { useEffect, useRef, useState } from "react";
import { toast } from "../lib/events";

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const w = (typeof window === "undefined" ? {} : window) as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

/** Arama kutusuna sesle yazma. Tarayıcı desteklemiyorsa hiç görünmez. */
export function MicButton({ onText, className = "" }: { onText: (text: string) => void; className?: string }) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);

  useEffect(() => {
    cb.current = onText;
  }, [onText]);

  useEffect(() => () => rec.current?.abort(), []);

  if (!Ctor) return null;
  const SR = Ctor;

  function toggle() {
    if (rec.current) {
      rec.current.stop();
      return;
    }
    const r = new SR();
    r.lang = "tr-TR";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      cb.current(text.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("Mikrofon izni verilmedi.", "error");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast("Ses anlaşılamadı, tekrar dene.", "error");
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Dinlemeyi durdur" : "Sesle ara"}
      aria-pressed={listening}
      className={`grid size-9 place-items-center rounded-full ${listening ? "animate-pulse bg-red-600 text-white" : "text-stone-500 active:bg-stone-100"} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}
