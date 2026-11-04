"use client";

/** "Olhinho" para esconder os valores na tela (como nos apps de banco). Fica salvo no aparelho. */

import { useEffect, useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/format";

const KEY = "planilha:privacy";
const EVENT = "planilha:privacy-change";

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export function usePrivacy(): [boolean, (v: boolean) => void] {
  const hidden = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
    },
    read,
    () => false,
  );
  const set = (v: boolean) => {
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* sem storage */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return [hidden, set];
}

/** Mantém a classe .privacy no <html> (o CSS borra os valores). */
export function PrivacySync() {
  const [hidden] = usePrivacy();
  useEffect(() => { document.documentElement.classList.toggle("privacy", hidden); }, [hidden]);
  return null;
}

export function PrivacyToggle({ className }: { className?: string }) {
  const [hidden, setHidden] = usePrivacy();
  return (
    <button type="button" onClick={() => setHidden(!hidden)} aria-pressed={hidden}
      aria-label={hidden ? "Mostrar valores" : "Esconder valores"} title={hidden ? "Mostrar valores" : "Esconder valores"}
      className={cn("rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800", className)}>
      {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}
