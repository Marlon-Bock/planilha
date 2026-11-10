"use client";

/**
 * Toque de casal: gatinhos, cachorrinhos e corações.
 * O modo fofinho fica sempre ligado; só quem ativou "reduzir movimento" no sistema vê tudo parado.
 */

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { cn } from "@/lib/format";
import { getLang, tr } from "@/lib/i18n";

/* ================================ Modo fofinho ================================ */

/** Garante a classe .cute no <html> e limpa a preferência antiga (o interruptor foi removido). */
export function CuteSync() {
  useEffect(() => {
    document.documentElement.classList.add("cute");
    try { localStorage.removeItem("planilha:cute"); } catch { /* navegação privada */ }
  }, []);
  return null;
}

export const motionAllowed = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

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

/* ============================ Peças do rostinho ============================ */

const INK = "#334155";

/** Olhos que seguem o dedo/mouse (via --lx/--ly) e viram ^ ^ quando o bichinho está feliz. */
function Eyes({ y = 45 }: { y?: number }) {
  return (
    <g className="pet-look">
      <g className="eyes-open">
        <ellipse className="cat-eye" cx="49" cy={y} rx="3.6" ry="4.6" fill={INK} />
        <ellipse className="cat-eye" cx="71" cy={y} rx="3.6" ry="4.6" fill={INK} />
        <circle cx="50.3" cy={y - 1.7} r="1.2" fill="#fff" />
        <circle cx="72.3" cy={y - 1.7} r="1.2" fill="#fff" />
      </g>
      <g className="eyes-happy" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round">
        <path d={`M45 ${y + 1.5} q4 -6 8 0`} />
        <path d={`M67 ${y + 1.5} q4 -6 8 0`} />
      </g>
    </g>
  );
}

function SleepyEyes({ y = 47 }: { y?: number }) {
  return (
    <>
      <path d={`M44 ${y} q5 4 10 0`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M66 ${y} q5 4 10 0`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}

/** "walk": de perfil, andando (só o cachorrinho tem). */
type Pose = "sit" | "peek" | "sleep" | "walk";

/* ================================== Gatinhos ================================== */

export const CAT_COLORS = {
  gray: { body: "#a3aebf", dark: "#7c889b", ear: "#f9a8d4" },
  ginger: { body: "#fdba74", dark: "#f59e0b", ear: "#f9a8d4" },
  cream: { body: "#fde7c8", dark: "#e7c79d", ear: "#f9a8d4" },
} as const;

export type CatColor = keyof typeof CAT_COLORS;

/**
 * Gatinho em SVG. `pose`: "sit" (sentado, com rabo), "peek" (só cabeça e
 * patinhas, para espiar por cima de um card) ou "sleep" (dormindo).
 */
export function Cat({ color = "gray", pose = "sit", className, flip }: { color?: CatColor; pose?: Pose; className?: string; flip?: boolean }) {
  const c = CAT_COLORS[color];
  const sleeping = pose === "sleep";
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
        <g className="cat-ears">
          <path d="M34 34 L38 8 L56 24 Z" fill={c.body} stroke={c.dark} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M86 34 L82 8 L64 24 Z" fill={c.body} stroke={c.dark} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M39 29 L41 15 L50 24 Z" fill={c.ear} />
          <path d="M81 29 L79 15 L70 24 Z" fill={c.ear} />
        </g>
        <ellipse cx="60" cy="46" rx="30" ry="26" fill={c.body} stroke={c.dark} strokeWidth="1.5" />

        {sleeping ? <SleepyEyes /> : <Eyes />}
        <ellipse cx="42" cy="55" rx="5" ry="3" fill="#f472b6" opacity=".45" />
        <ellipse cx="78" cy="55" rx="5" ry="3" fill="#f472b6" opacity=".45" />
        <path d="M57 52 h6 l-3 3.2 z" fill="#f472b6" />
        <path d="M60 55.5 q-2 4 -5 2.5 M60 55.5 q2 4 5 2.5" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        <g stroke={INK} strokeWidth="1.1" strokeLinecap="round" opacity=".55">
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

/* ================================ Cachorrinhos ================================ */

export const DOG_COLORS = {
  caramel: { body: "#f2c08a", dark: "#d39257", ear: "#b8743c", muzzle: "#fff1df", spot: null },
  white: { body: "#fffdf8", dark: "#d6cfc4", ear: "#d9a877", muzzle: "#ffffff", spot: "#e8c39b" },
  choco: { body: "#b07d57", dark: "#83593a", ear: "#6d4529", muzzle: "#f0d9bf", spot: null },
} as const;

export type DogColor = keyof typeof DOG_COLORS;

/**
 * Cachorrinho de perfil, andando (olhando para a esquerda; `flip` vira para a direita).
 * As patinhas alternam o passo; as do lado de lá são mais escuras, para dar profundidade.
 */
function DogWalking({ c, collar, className, flip }: { c: (typeof DOG_COLORS)[DogColor]; collar: string | null; className?: string; flip?: boolean }) {
  const leg = (x: number, cls: string, far?: boolean) => (
    <rect className={cls} x={x - 5} y="84" width="10" height="22" rx="5" fill={far ? c.dark : c.body} stroke={c.dark} strokeWidth="1.5" />
  );
  return (
    <svg viewBox="0 0 120 110" className={cn("overflow-visible", className)} aria-hidden>
      <g transform={flip ? "translate(120 0) scale(-1 1)" : undefined}>
        {/* Patinhas do lado de lá */}
        {leg(52, "dog-leg-b", true)}
        {leg(88, "dog-leg-a", true)}
        <path className="dog-tail" d="M98 72 C110 68 114 56 109 46" fill="none" stroke={c.dark} strokeWidth="8" strokeLinecap="round" />
        {/* Corpo */}
        <ellipse cx="70" cy="76" rx="32" ry="17" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
        <ellipse cx="68" cy="84" rx="20" ry="7" fill={c.muzzle} opacity=".8" />
        {c.spot && <ellipse cx="82" cy="68" rx="10" ry="7" fill={c.spot} />}
        {/* Patinhas do lado de cá */}
        {leg(46, "dog-leg-a")}
        {leg(82, "dog-leg-b")}
        {/* Cabeça de perfil */}
        <g className="dog-head-bob">
          <ellipse cx="38" cy="46" rx="24" ry="22" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          {/* Focinho apontando para a frente */}
          <ellipse cx="19" cy="55" rx="13" ry="9.5" fill={c.muzzle} stroke={c.dark} strokeWidth="1" />
          <ellipse cx="8.5" cy="50.5" rx="4.6" ry="3.6" fill={INK} />
          <ellipse cx="7.4" cy="49.6" rx="1.3" ry=".8" fill="#fff" opacity=".7" />
          <path d="M10 58 q5 4.5 11 2" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <path className="dog-tongue" d="M13 60.4 q3 8 6.4 1.2 z" fill="#fb7185" />
          {/* Olho (um só, de perfil) */}
          <g className="eyes-open">
            <ellipse className="cat-eye" cx="30" cy="42" rx="3.6" ry="4.4" fill={INK} />
            <circle cx="28.8" cy="40.4" r="1.3" fill="#fff" />
          </g>
          <path className="eyes-happy" d="M26 43 q4 -5 8 0" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="33" cy="54" rx="5" ry="3" fill="#f472b6" opacity=".4" />
          {/* Orelha caída do lado de cá */}
          <path className="dog-ear-r" d="M44 26 C60 24 66 46 59 59 C54 67 44 58 42 43 Z" fill={c.ear} />
        </g>
        {/* Coleira com plaquinha */}
        {collar && (
          <>
            <path d="M46 64 Q54 70 60 62" fill="none" stroke={collar} strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="52" cy="70.5" r="3.4" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Cachorrinho em SVG, com as mesmas poses do gatinho. Orelhinhas caídas, linguinha e coleira com plaquinha. */
export function Dog({ color = "caramel", pose = "sit", className, flip, collar = "#ec4899" }: { color?: DogColor; pose?: Pose; className?: string; flip?: boolean; collar?: string | null }) {
  const c = DOG_COLORS[color];
  const sleeping = pose === "sleep";
  const viewBox = pose === "peek" ? "0 0 120 78" : "0 0 120 110";
  if (pose === "walk") return <DogWalking c={c} collar={collar} className={className} flip={flip} />;

  return (
    <svg viewBox={viewBox} className={cn("overflow-visible", className)} aria-hidden>
      <g transform={flip ? "translate(120 0) scale(-1 1)" : undefined}>
      {pose === "sit" && (
        <>
          <path className="dog-tail" d="M84 94 C98 92 104 80 101 68" fill="none" stroke={c.dark} strokeWidth="8" strokeLinecap="round" />
          <ellipse cx="60" cy="88" rx="29" ry="20" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          <ellipse cx="60" cy="93" rx="15" ry="11" fill={c.muzzle} opacity=".85" />
          <ellipse cx="47" cy="106" rx="8.5" ry="5" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          <ellipse cx="73" cy="106" rx="8.5" ry="5" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          {/* Coleira com plaquinha */}
          {collar && (
            <>
              <path d="M40 69 Q60 79 80 69" fill="none" stroke={collar} strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="60" cy="79" r="3.6" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
            </>
          )}
        </>
      )}
      {sleeping && (
        <>
          <ellipse cx="62" cy="92" rx="40" ry="17" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          <path d="M100 96 C112 96 112 106 96 106" fill="none" stroke={c.dark} strokeWidth="7" strokeLinecap="round" />
        </>
      )}

      {/* Cabeça */}
      <g transform={sleeping ? "translate(-14 30) rotate(-8 60 50)" : undefined}>
        <path className="dog-ear-l" d="M38 26 C22 26 16 50 24 62 C30 70 41 60 42 44 Z" fill={c.ear} />
        <path className="dog-ear-r" d="M82 26 C98 26 104 50 96 62 C90 70 79 60 78 44 Z" fill={c.ear} />
        <ellipse cx="60" cy="44" rx="27" ry="25" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
        {c.spot && <ellipse cx="72" cy="41" rx="9.5" ry="8.5" fill={c.spot} />}

        {sleeping ? <SleepyEyes y={44} /> : <Eyes y={42} />}
        <ellipse cx="41" cy="54" rx="5" ry="3" fill="#f472b6" opacity=".4" />
        <ellipse cx="79" cy="54" rx="5" ry="3" fill="#f472b6" opacity=".4" />
        <ellipse cx="60" cy="56.5" rx="13" ry="9.5" fill={c.muzzle} />
        <ellipse cx="60" cy="51.5" rx="5.2" ry="3.7" fill={INK} />
        <ellipse cx="58.4" cy="50.5" rx="1.5" ry=".9" fill="#fff" opacity=".7" />
        <path d="M60 55 v2.6 M60 57.6 q-3 3.6 -6.2 1 M60 57.6 q3 3.6 6.2 1" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        {!sleeping && <path className="dog-tongue" d="M57.4 59.6 q2.6 7.5 5.2 0 z" fill="#fb7185" />}
      </g>

      {pose === "peek" && (
        <>
          <ellipse cx="42" cy="73" rx="10.5" ry="6" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          <ellipse cx="78" cy="73" rx="10.5" ry="6" fill={c.body} stroke={c.dark} strokeWidth="1.5" />
          <path d="M38 71 v4 M42 70 v5 M46 71 v4 M74 71 v4 M78 70 v5 M82 71 v4" stroke={c.dark} strokeWidth="1" strokeLinecap="round" />
        </>
      )}
      </g>
    </svg>
  );
}

/* ============================ Bichinhos interativos ============================ */

export type Critter = { kind: "cat"; color: CatColor } | { kind: "dog"; color: DogColor; collar?: string | null };

/** Desenha um gatinho ou cachorrinho conforme o tipo. */
export function CritterArt({ critter, pose, className, flip }: { critter: Critter; pose?: Pose; className?: string; flip?: boolean }) {
  return critter.kind === "cat"
    ? <Cat color={critter.color} pose={pose} className={className} flip={flip} />
    : <Dog color={critter.color} pose={pose} className={className} flip={flip} collar={critter.collar} />;
}

const phrases = () => ({
  cat: getLang() === "en"
    ? ["Meow! 💕", "Purr purr~", "Pet me?", "Love you! 💗", "Where's my treat?", "Meow meow 🐾", "So cozy~"]
    : ["Miau! 💕", "Purr purr~", "Me dá carinho?", "Te amo! 💗", "Cadê meu sachê?", "Miau miau 🐾", "Que cafuné bom~"],
  dog: getLang() === "en"
    ? ["Woof! 💕", "Walkies?", "Love you! 💗", "Treat please?", "More pets!", "Arf! 🐾", "Best day ever!"]
    : ["Au au! 💕", "Bora passear?", "Te amo! 💗", "Cadê o petisco?", "Mais carinho!", "Au! 🐾", "Melhor dia!"],
});

/** Os olhinhos do bichinho acompanham o dedo/mouse (atualiza --lx/--ly no elemento). */
export function useLookAt(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!motionAllowed()) return;
    let raf = 0;
    let x = 0, y = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height * 0.4);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 140);
      el.style.setProperty("--lx", ((dx / d) * k).toFixed(2));
      el.style.setProperty("--ly", ((dy / d) * k).toFixed(2));
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
}

/** Balãozinho de fala. */
export function Bubble({ text, ms = 1800, align = "center" }: { text: string; ms?: number; align?: "center" | "left" | "right" }) {
  return (
    <span className={cn("pointer-events-none absolute bottom-full z-10 mb-1 flex",
      align === "center" && "left-1/2 -translate-x-1/2", align === "left" && "left-0", align === "right" && "right-0")}>
      <span key={text} style={{ animationDuration: `${ms}ms` }} className="pet-bubble whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-600 shadow-md ring-1 ring-brand-100 dark:bg-slate-800 dark:text-brand-300 dark:ring-brand-500/30">
        {text}
      </span>
    </span>
  );
}

/** Reações compartilhadas: pulinho, olhinhos felizes, corações e frase. */
export function usePetReactions(kind: Critter["kind"]) {
  const [boing, setBoing] = useState(0);
  const [happy, setHappy] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; ms: number } | null>(null);
  const clicks = useRef<number[]>([]);
  const timers = useRef<{ happy?: ReturnType<typeof setTimeout>; bubble?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => () => { clearTimeout(timers.current.happy); clearTimeout(timers.current.bubble); }, []);

  const say = (text: string, ms = 1800) => {
    setBubble({ text, ms });
    clearTimeout(timers.current.bubble);
    timers.current.bubble = setTimeout(() => setBubble(null), ms);
  };

  const react = (e: ReactMouseEvent | Element | null, hearts = 10) => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 2500), now];
    const party = clicks.current.length >= 5;
    if (party) { clicks.current = []; heartRain(26); }
    burstFrom(e, party ? 18 : hearts);
    setBoing((b) => b + 1);
    setHappy(true);
    clearTimeout(timers.current.happy);
    timers.current.happy = setTimeout(() => setHappy(false), 1400);
    say(party ? tr("Muito amor!! 💞", "So much love!! 💞") : pick(phrases()[kind]));
  };

  return { boing, happy, bubble, say, react, bump: () => setBoing((b) => b + 1) };
}

/**
 * Bichinho clicável: pula, fecha os olhinhos de felicidade, solta corações e fala.
 * 5 toques seguidos = chuva de corações.
 */
export function Pet({ critter, pose = "sit", className, label, flip, hearts = 10, bubbleAlign = "center", onPet }: {
  critter: Critter; pose?: Pose; className?: string; label?: string; flip?: boolean; hearts?: number; bubbleAlign?: "center" | "left" | "right"; onPet?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { boing, happy, bubble, react } = usePetReactions(critter.kind);
  useLookAt(ref);

  return (
    <button ref={ref} type="button" onClick={(e) => { react(e, hearts); onPet?.(); }}
      aria-label={label ?? (critter.kind === "cat" ? tr("Gatinho", "Kitty") : tr("Cachorrinho", "Puppy"))} title={tr("Faz um carinho 💕", "Give a pet 💕")}
      className={cn("pet relative inline-block shrink-0 touch-manipulation outline-none select-none", happy && "pet-happy", className)}>
      <span key={boing} className={cn("block h-full w-full transition-transform hover:-translate-y-0.5", boing > 0 && "pet-boing")}>
        <CritterArt critter={critter} pose={pose} flip={flip} className="h-full w-full" />
      </span>
      {bubble && <Bubble text={bubble.text} ms={bubble.ms} align={bubbleAlign} />}
    </button>
  );
}

export function Heart({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

/** A família: casal de gatinhos com coração batendo e o cachorrinho do lado. */
export function CatCouple({ className }: { className?: string }) {
  return (
    <div className={cn("relative inline-flex items-end gap-1", className)}>
      <Pet critter={{ kind: "cat", color: "gray" }} className="h-24 w-24" hearts={14} />
      <Heart className="mb-14 h-7 w-7 text-brand-500 animate-heartbeat" />
      <Pet critter={{ kind: "cat", color: "ginger" }} flip className="h-24 w-24" hearts={14} />
      <Pet critter={{ kind: "dog", color: "caramel" }} className="-ml-3 h-16 w-16" hearts={10} />
    </div>
  );
}

/** Bichinho dormindo para telas vazias (gatinho ou cachorrinho, fixo por tela). */
export function SleepyCat({ className, seed = "" }: { className?: string; seed?: string }) {
  const sleepers: Critter[] = [{ kind: "cat", color: "cream" }, { kind: "dog", color: "caramel" }, { kind: "cat", color: "gray" }, { kind: "dog", color: "white" }];
  const hash = [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  // Tocou: acorda, senta e fica um tempinho acordado; depois volta a dormir.
  const [awake, setAwake] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const wake = () => {
    setAwake(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAwake(false), 8000);
  };
  return (
    <div className={cn("relative", className)}>
      <Pet critter={sleepers[hash % sleepers.length]} pose={awake ? "sit" : "sleep"} className="h-20 w-24" hearts={6} onPet={wake} />
      {!awake && <span className="pointer-events-none absolute -top-1 right-0 text-sm font-bold text-brand-400 animate-bob">z<span className="text-xs">z</span></span>}
    </div>
  );
}

/** Spinner de coração. */
export function HeartSpinner({ className }: { className?: string }) {
  return <Heart className={cn("h-6 w-6 text-brand-500 animate-[heartbeat_1.2s_ease-in-out_infinite]", className)} />;
}
