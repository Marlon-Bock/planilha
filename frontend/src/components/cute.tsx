"use client";

/**
 * Toque de casal: gatinhos, corações e o "modo fofinho".
 * Tudo respeita o interruptor do perfil e o "reduzir movimento" do sistema.
 */

import { useEffect, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from "react";
import { cn } from "@/lib/format";

/* ================================ Modo fofinho ================================ */

const KEY = "planilha:cute";
const EVENT = "planilha:cute-change";

const readCute = () => {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
};

export function useCuteMode(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
    },
    readCute,
    () => true,
  );
  const set = (v: boolean) => {
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* navegação privada */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}

/** Mantém a classe .cute do <html> em sincronia com a preferência. */
export function CuteSync() {
  const [on] = useCuteMode();
  useEffect(() => { document.documentElement.classList.toggle("cute", on); }, [on]);
  return null;
}

const motionAllowed = () =>
  typeof window !== "undefined" &&
  document.documentElement.classList.contains("cute") &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================== Explosão de corações ============================== */

const PINKS = ["#f472b6", "#ec4899", "#fb7185", "#f9a8d4", "#db2777", "#c084fc"];
const heartSvg = (color: string) =>
  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="${color}"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>`;

/** Solta corações a partir de um ponto da tela (x, y em px). */
export function burstHearts(x: number, y: number, count = 10) {
  if (!motionAllowed()) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 40 + Math.random() * 50;
    const size = 12 + Math.random() * 12;
    el.innerHTML = heartSvg(PINKS[i % PINKS.length]);
    Object.assign(el.style, {
      position: "fixed", left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`,
      pointerEvents: "none", zIndex: "100",
      animation: `heart-fly ${700 + Math.random() * 400}ms cubic-bezier(.2,.7,.3,1) forwards`,
    });
    el.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--dy", `${Math.sin(angle) * dist - 30}px`);
    el.style.setProperty("--s", `${0.8 + Math.random() * 0.6}`);
    el.style.setProperty("--r", `${Math.random() * 60 - 30}deg`);
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

/** Corações saindo do centro de um elemento (ou do ponto do clique). */
export function burstFrom(target: Element | ReactMouseEvent | null | undefined, count?: number) {
  if (!target) return;
  if ("clientX" in target && target.clientX) return burstHearts(target.clientX, target.clientY, count);
  const el = "currentTarget" in target ? (target.currentTarget as Element) : (target as Element);
  const r = el.getBoundingClientRect();
  burstHearts(r.left + r.width / 2, r.top + r.height / 2, count);
}

/** Chuva de corações na tela toda (comemorações). */
export function heartRain(count = 36) {
  if (!motionAllowed()) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    const size = 14 + Math.random() * 18;
    el.innerHTML = heartSvg(PINKS[i % PINKS.length]);
    Object.assign(el.style, {
      position: "fixed", top: "0", left: `${Math.random() * 100}vw`, width: `${size}px`, height: `${size}px`,
      pointerEvents: "none", zIndex: "100", opacity: "0",
      animation: `heart-rain ${2.6 + Math.random() * 2}s linear ${Math.random() * 1.8}s forwards`,
    });
    el.style.setProperty("--r", `${Math.random() * 360 - 180}deg`);
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

/* ================================== Gatinhos ================================== */

export const CAT_COLORS = {
  gray: { body: "#a3aebf", dark: "#7c889b", ear: "#f9a8d4" },
  ginger: { body: "#fdba74", dark: "#f59e0b", ear: "#f9a8d4" },
  cream: { body: "#fde7c8", dark: "#e7c79d", ear: "#f9a8d4" },
} as const;

type CatColor = keyof typeof CAT_COLORS;

/**
 * Gatinho em SVG. `pose`: "sit" (sentado, com rabo), "peek" (só cabeça e
 * patinhas, para espiar por cima de um card) ou "sleep" (dormindo).
 */
export function Cat({ color = "gray", pose = "sit", className, flip }: { color?: CatColor; pose?: "sit" | "peek" | "sleep"; className?: string; flip?: boolean }) {
  const c = CAT_COLORS[color];
  const sleeping = pose === "sleep";
  const ink = "#334155";
  const viewBox = pose === "peek" ? "0 0 120 78" : "0 0 120 110";

  return (
    <svg viewBox={viewBox} className={cn("overflow-visible", className)} aria-hidden>
      <g transform={flip ? "translate(120 0) scale(-1 1)" : undefined}>
      {pose === "sit" && (
        <>
          <path className="cat-tail" d="M86 96 C112 94 110 66 100 62" fill="none" stroke={c.dark} strokeWidth="9" strokeLinecap="round" />
          <ellipse cx="60" cy="88" rx="30" ry="20" fill={c.body} />
          <ellipse cx="60" cy="92" rx="16" ry="12" fill="#fff" opacity=".55" />
          <ellipse cx="48" cy="106" rx="8" ry="5" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          <ellipse cx="72" cy="106" rx="8" ry="5" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
        </>
      )}
      {sleeping && (
        <>
          <ellipse cx="62" cy="92" rx="40" ry="17" fill={c.body} />
          <path d="M98 94 C112 92 112 106 92 106" fill="none" stroke={c.dark} strokeWidth="8" strokeLinecap="round" />
        </>
      )}

      {/* Cabeça */}
      <g transform={sleeping ? "translate(-14 30) rotate(-8 60 50)" : undefined}>
        <path d="M34 34 L38 8 L56 24 Z" fill={c.body} stroke={c.dark} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M86 34 L82 8 L64 24 Z" fill={c.body} stroke={c.dark} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M39 29 L41 15 L50 24 Z" fill={c.ear} />
        <path d="M81 29 L79 15 L70 24 Z" fill={c.ear} />
        <ellipse cx="60" cy="46" rx="30" ry="26" fill={c.body} stroke={c.dark} strokeWidth="1.5" />

        {sleeping ? (
          <>
            <path d="M44 47 q5 4 10 0" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M66 47 q5 4 10 0" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse className="cat-eye" cx="49" cy="45" rx="3.6" ry="4.6" fill={ink} />
            <ellipse className="cat-eye" cx="71" cy="45" rx="3.6" ry="4.6" fill={ink} />
            <circle cx="50.3" cy="43.3" r="1.2" fill="#fff" />
            <circle cx="72.3" cy="43.3" r="1.2" fill="#fff" />
          </>
        )}
        <ellipse cx="42" cy="55" rx="5" ry="3" fill="#f472b6" opacity=".45" />
        <ellipse cx="78" cy="55" rx="5" ry="3" fill="#f472b6" opacity=".45" />
        <path d="M57 52 h6 l-3 3.2 z" fill="#f472b6" />
        <path d="M60 55.5 q-2 4 -5 2.5 M60 55.5 q2 4 5 2.5" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
        <g stroke={ink} strokeWidth="1.1" strokeLinecap="round" opacity=".55">
          <path d="M36 51 l-12 -2 M36 55 l-12 2" />
          <path d="M84 51 l12 -2 M84 55 l12 2" />
        </g>
      </g>

      {pose === "peek" && (
        <>
          <ellipse cx="42" cy="73" rx="10" ry="6" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          <ellipse cx="78" cy="73" rx="10" ry="6" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          <path d="M38 71 v4 M42 70 v5 M46 71 v4 M74 71 v4 M78 70 v5 M82 71 v4" stroke={c.dark} strokeWidth="1" strokeLinecap="round" />
        </>
      )}
      </g>
    </svg>
  );
}

export function Heart({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

/** O casal de gatinhos com um coração batendo no meio. Clique = carinho (corações). */
export function CatCouple({ className }: { className?: string }) {
  return (
    <button type="button" onClick={(e) => burstFrom(e, 14)} title="Faz um carinho 💕" aria-label="Casal de gatinhos"
      className={cn("group relative inline-flex items-end gap-1 outline-none", className)}>
      <Cat color="gray" className="h-24 w-24 transition-transform duration-300 cute:group-hover:-translate-y-1 cute:group-hover:-rotate-3" />
      <Heart className="mb-14 h-7 w-7 text-brand-500 animate-heartbeat" />
      <Cat color="ginger" flip className="h-24 w-24 transition-transform duration-300 cute:group-hover:-translate-y-1 cute:group-hover:rotate-3" />
    </button>
  );
}

/** Gatinho dormindo para telas vazias. */
export function SleepyCat({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Cat color="cream" pose="sleep" className="h-20 w-24" />
      <span className="absolute -top-1 right-0 text-sm font-bold text-brand-400 animate-bob">z<span className="text-xs">z</span></span>
    </div>
  );
}

/** Spinner de coração. */
export function HeartSpinner({ className }: { className?: string }) {
  // Animação própria (não some no modo sem fofura: é indicador de carregamento).
  return <Heart className={cn("h-6 w-6 text-brand-500 animate-[heartbeat_1.2s_ease-in-out_infinite]", className)} />;
}
