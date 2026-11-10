"use client";

/**
 * O cachorrinho do usuário: mora na tela (PetBuddy) e é cuidado no Perfil (MyPetCard).
 * Nome, cor, coleira, refeição e carinhos ficam salvos na conta (users.pet).
 * A posição na tela fica salva no aparelho.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bone, Check } from "lucide-react";
import { toast } from "sonner";
import { api, parseError } from "@/lib/api";
import { cn } from "@/lib/format";
import { getLang, tr } from "@/lib/i18n";
import type { PetData, User } from "@/lib/types";
import { useAuth } from "@/components/auth";
import { Bubble, burstFrom, CritterArt, DOG_COLORS, type DogColor, motionAllowed, Pet, pick, useLookAt, usePetReactions } from "@/components/cute";
import { Button, Card, Field, Input, Toggle } from "@/components/ui";

const DEFAULT_COLLAR = "#ec4899";
export const COLLARS = [DEFAULT_COLLAR, "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#334155"];
const HUNGRY_AFTER = 8 * 60 * 60 * 1000; // 8 horas sem ração

/** Dados do pet com os padrões de quem ainda não mexeu em nada. */
export function petOf(user: User | null | undefined): PetData {
  const p = user?.pet;
  return {
    name: p?.name ?? null,
    color: p?.color ?? "caramel",
    collar: p ? p.collar : DEFAULT_COLLAR,
    wander: p?.wander ?? true,
    fed_at: p?.fed_at ?? null,
    love: p?.love ?? 0,
  };
}

const isHungry = (pet: PetData) => !pet.fed_at || Date.now() - new Date(pet.fed_at).getTime() > HUNGRY_AFTER;

/** Ações do pet (salvar aparência, dar ração, contar carinhos). */
export function useMyPet() {
  const { user, setUser } = useAuth();
  const pet = petOf(user);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = async (patch: Partial<Pick<PetData, "name" | "color" | "collar" | "wander">>) => {
    try {
      const { data } = await api.put<{ user: User }>("/profile/pet", { name: pet.name, color: pet.color, collar: pet.collar, wander: pet.wander, ...patch });
      setUser(data.user);
      return true;
    } catch (err) {
      toast.error(parseError(err).message);
      return false;
    }
  };

  const feed = async () => {
    try {
      const { data } = await api.post<{ user: User }>("/profile/pet/feed");
      setUser(data.user);
      return true;
    } catch (err) {
      toast.error(parseError(err).message);
      return false;
    }
  };

  /** Junta os carinhos e manda de uma vez, para não chamar o servidor a cada toque. */
  const love = (n = 1) => {
    pending.current += n;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const count = Math.min(pending.current, 50);
      pending.current = 0;
      api.post<{ user: User }>("/profile/pet/love", { count }).then(({ data }) => setUser(data.user)).catch(() => {});
    }, 2000);
  };

  return { pet, save, feed, love };
}

/* ============================ O pet andando pela tela ============================ */

const POS_KEY = "planilha:pet-pos";
const HINT_KEY = "planilha:pet-hint";
const SIZE = 68;
const SPEED = 230; // px por segundo
const MAX_WALK = 3200; // atravessar a tela inteira não demora mais que isso
const SLEEP_AFTER = 90_000;

type Point = { x: number; y: number };

const readPos = (): Point | null => {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    return p && typeof p.x === "number" && typeof p.y === "number" ? { x: p.x, y: p.y } : null;
  } catch {
    return null;
  }
};
const writePos = (p: Point) => {
  try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* sem storage */ }
};

const subscribeViewport = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const viewportSnapshot = () => `${window.innerWidth}x${window.innerHeight}`;

/**
 * O cachorrinho na tela:
 * - arraste e solte em qualquer lugar: ele fica ali;
 * - toque nele (carinho) e depois toque em outro ponto da tela: ele vai andando até lá;
 * - de vez em quando passeia sozinho (dá para desligar no Perfil) e, sem ninguém brincar, dorme.
 */
export function PetBuddy() {
  const [vw, vh] = useSyncExternalStore(subscribeViewport, viewportSnapshot, () => "390x844").split("x").map(Number);
  const desktop = vw >= 1024;
  const { pet, love } = useMyPet();
  // Sem posição salva: começa no canto de baixo, à direita (o clamp ajusta).
  const [pos, setPos] = useState<Point>(() => readPos() ?? { x: 99999, y: 99999 });
  const [drag, setDrag] = useState<Point | null>(null);
  const [walkMs, setWalkMs] = useState(0); // > 0 enquanto anda
  const [faceRight, setFaceRight] = useState(false);
  const [armed, setArmed] = useState(false); // tocou nele: o próximo toque na tela é o destino
  const [sleeping, setSleeping] = useState(false);
  const [activity, setActivity] = useState(0);
  const [strolls, setStrolls] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const walkTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { boing, happy, bubble, say, react, bump } = usePetReactions("dog");
  useLookAt(ref);

  // Limites: no PC não entra embaixo do menu lateral; no celular não cobre a barra de baixo.
  const minX = desktop ? 264 : 4;
  const maxX = Math.max(minX, vw - SIZE - 4);
  const minY = 4;
  const maxY = Math.max(minY, vh - SIZE - (desktop ? 8 : 88));
  const clamp = (p: Point): Point => ({ x: Math.min(Math.max(p.x, minX), maxX), y: Math.min(Math.max(p.y, minY), maxY) });
  const cur = clamp(pos);

  const wake = () => { setActivity((a) => a + 1); setSleeping(false); };

  /** Anda até o ponto (x, y) da tela; `quiet` = passeio sozinho, sem falar ao chegar. */
  const walkTo = (x: number, y: number, quiet = false) => {
    const target = clamp({ x: x - SIZE / 2, y: y - SIZE * 0.8 });
    // Parte de onde ele está de verdade (pode estar no meio de outra caminhada).
    const rect = ref.current?.getBoundingClientRect();
    const from = rect ? { x: rect.left, y: rect.top } : cur;
    const dist = Math.hypot(target.x - from.x, target.y - from.y);
    if (dist < 6) return;
    const ms = motionAllowed() ? Math.min(MAX_WALK, Math.max(350, (dist / SPEED) * 1000)) : 1;
    setFaceRight(target.x > from.x);
    setWalkMs(ms);
    setPos(target);
    writePos(target);
    clearTimeout(walkTimer.current);
    walkTimer.current = setTimeout(() => {
      setWalkMs(0);
      setStrolls((n) => n + 1);
      if (!quiet) {
        bump();
        say(pick(getLang() === "en" ? ["Here I am! 🐾", "Made it! 💕", "Nice spot~"] : ["Cheguei! 🐾", "Tô aqui! 💕", "Que lugar bom~"]));
      }
    }, ms);
  };
  useEffect(() => () => clearTimeout(walkTimer.current), []);

  // Dorme depois de um tempo sem ninguém brincar.
  useEffect(() => {
    const t = setTimeout(() => setSleeping(true), SLEEP_AFTER);
    return () => clearTimeout(t);
  }, [activity]);

  // Passeia sozinho de vez em quando (acordado, sem estar sendo arrastado ou guiado).
  const dragging = !!drag;
  useEffect(() => {
    if (!pet.wander || sleeping || armed || dragging || !motionAllowed()) return;
    const t = setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      walkTo(rect.left + SIZE / 2 + (Math.random() * 2 - 1) * 240, rect.top + SIZE * 0.8 + (Math.random() * 2 - 1) * 50, true);
    }, 8000 + Math.random() * 10000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.wander, sleeping, armed, dragging, strolls, vw, vh]);

  // Depois de tocar nele, o destino precisa ser escolhido em alguns segundos.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 7000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setArmed(false);
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); };
  }, [armed]);

  // Ao abrir: ensina a brincar (primeira vez) ou avisa que está com fome.
  useEffect(() => {
    let taught = true;
    try { taught = !!localStorage.getItem(HINT_KEY); } catch { /* sem storage */ }
    const hungry = isHungry(pet);
    if (taught && !hungry) return;
    const t = setTimeout(() => {
      if (!taught) {
        try { localStorage.setItem(HINT_KEY, "1"); } catch { /* sem storage */ }
        say(tr("Toque em mim e depois na tela 🐾", "Tap me, then tap the screen 🐾"), 4500);
      } else {
        say(tr("Tô com fome! 🍖", "I'm hungry! 🍖"), 3200);
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = (target: Element) => {
    if (sleeping) {
      wake(); bump(); burstFrom(target, 6);
      say(tr("Hã? Ah, oi! 💕", "Huh? Oh, hi! 💕"));
      return;
    }
    wake();
    react(target, 8); // carinho: pulinho, corações e uma frase
    love(1);
    setArmed((a) => !a);
  };

  const label = pet.name || tr("Meu cachorrinho", "My puppy");

  return (
    <>
      {/* Esperando o destino: a tela inteira vira "para onde eu vou?". */}
      {armed && (
        <div className="fixed inset-0 z-[45] cursor-crosshair touch-none print:hidden" aria-hidden
          onPointerDown={(e) => { e.preventDefault(); setArmed(false); wake(); walkTo(e.clientX, e.clientY); }} />
      )}
      <div ref={ref} role="button" tabIndex={0}
        aria-label={tr(`${label}: toque para fazer carinho e depois toque na tela para ele ir até lá; arraste para mudar de lugar`, `${label}: tap to pet, then tap the screen to send it there; drag to move`)}
        title={label}
        className={cn("pet fixed cursor-grab touch-none outline-none select-none active:cursor-grabbing print:hidden", armed ? "z-[46]" : "z-[35]", happy && "pet-happy")}
        style={{
          left: drag ? drag.x : cur.x, top: drag ? drag.y : cur.y, width: SIZE, height: SIZE,
          transition: !drag && walkMs ? `left ${walkMs}ms linear, top ${walkMs}ms linear` : "none",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          press.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p) return;
          if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
          if (!p.moved) {
            p.moved = true;
            wake(); setArmed(false);
            clearTimeout(walkTimer.current); setWalkMs(0);
            say(tr("Uiii! 🎈", "Wheee! 🎈"), 1200);
          }
          setDrag({ x: Math.min(Math.max(e.clientX - SIZE / 2, 0), vw - SIZE), y: Math.min(Math.max(e.clientY - SIZE * 0.25, 0), vh - SIZE) });
        }}
        onPointerUp={(e) => {
          const p = press.current;
          press.current = null;
          if (!p) return;
          if (!p.moved) return tap(e.currentTarget);
          // Fica exatamente onde foi solto.
          const dropped = clamp({ x: e.clientX - SIZE / 2, y: e.clientY - SIZE * 0.25 });
          setPos(dropped);
          writePos(dropped);
          setDrag(null);
          bump();
          say(pick(getLang() === "en" ? ["Perfect spot! 💕", "I'll stay here! 🐾", "Nice view~"] : ["Aqui tá ótimo! 💕", "Vou ficar aqui! 🐾", "Que vista linda~"]));
        }}
        onPointerCancel={() => { press.current = null; setDrag(null); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(e.currentTarget); } }}>
        {/* Sombrinha no chão */}
        {!drag && <span className="absolute -bottom-0.5 left-1/2 h-2 w-10 -translate-x-1/2 rounded-full bg-slate-900/10 blur-[2px] dark:bg-black/30" />}
        {armed && <span className="pointer-events-none absolute -inset-1.5 animate-ping rounded-full border-2 border-brand-400/70" />}
        <span key={boing} className={cn("block h-full w-full", drag ? "pet-dragging" : walkMs ? "pet-walk" : boing > 0 && "pet-boing")}>
          <CritterArt critter={{ kind: "dog", color: pet.color, collar: pet.collar }} pose={walkMs && !drag ? "walk" : sleeping && !drag ? "sleep" : "sit"} flip={faceRight} className="h-full w-full drop-shadow-sm" />
        </span>
        {sleeping && !drag && !walkMs && (
          <span className="pointer-events-none absolute -top-2 right-1 text-sm font-bold text-brand-400 animate-bob">z<span className="text-xs">z</span></span>
        )}
        {armed && (
          <span className={cn("pointer-events-none absolute whitespace-nowrap rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-md",
            // Perto do fim da tela o aviso vai para cima dele; perto das bordas, não sai da tela.
            cur.y > vh - SIZE - 120 ? "bottom-full mb-8" : "top-full mt-1.5",
            cur.x > vw - 200 ? "right-0" : cur.x < minX + 60 ? "left-0" : "left-1/2 -translate-x-1/2")}>
            {tr("Pra onde? Toque na tela 🐾", "Where to? Tap the screen 🐾")}
          </span>
        )}
        {bubble && <Bubble text={bubble.text} ms={bubble.ms} align={cur.x > vw / 2 ? "right" : "left"} />}
      </div>
    </>
  );
}

/* ================================ Card do Perfil ================================ */

const colorNames = (): Record<DogColor, string> => ({
  caramel: tr("Caramelo", "Caramel"),
  white: tr("Branquinho", "White"),
  choco: tr("Chocolate", "Chocolate"),
});

/** Cuidar do cachorrinho: nome, pelo, coleira, ração e carinho. */
export function MyPetCard({ className }: { className?: string }) {
  const { pet, save, feed, love } = useMyPet();
  const [name, setName] = useState(pet.name ?? "");
  const [feeding, setFeeding] = useState(false);
  const hungry = isHungry(pet);
  const shown = pet.name || tr("seu cachorrinho", "your puppy");

  const saveName = async () => {
    const clean = name.trim();
    if (clean === (pet.name ?? "")) return;
    if (await save({ name: clean || null })) toast.success(clean ? tr(`Agora ele se chama ${clean} 🐾`, `Now it's called ${clean} 🐾`) : tr("Nome removido", "Name removed"));
  };

  const giveFood = async (e: React.MouseEvent) => {
    burstFrom(e, 12);
    setFeeding(true);
    if (await feed()) toast.success(tr(`Nhac nhac! ${pet.name || "Ele"} adorou a ração 🍖`, `Nom nom! ${pet.name || "It"} loved the food 🍖`));
    setFeeding(false);
  };

  const swatch = "relative flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110 dark:ring-offset-slate-900";

  return (
    <Card title={tr("Meu cachorrinho 🐶", "My puppy 🐶")} className={className}>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2 pt-6 sm:w-40">
          <Pet critter={{ kind: "dog", color: pet.color, collar: pet.collar }} className="h-28 w-28" hearts={12} onPet={() => love(1)}
            label={tr(`Fazer carinho em ${shown}`, `Pet ${shown}`)} />
          <p className="text-base font-semibold text-slate-900 dark:text-white">{pet.name || tr("Sem nome ainda", "No name yet")}</p>
          <p className={cn("text-xs font-medium", hungry ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400")}>
            {hungry ? tr("Com fome 🍖", "Hungry 🍖") : tr("Barriguinha cheia 😋", "Full tummy 😋")}
          </p>
          <p className="text-xs text-slate-500">{tr(`${pet.love.toLocaleString("pt-BR")} carinho(s) 💕`, `${pet.love.toLocaleString("en-US")} pet(s) 💕`)}</p>
          <Button size="sm" variant={hungry ? "primary" : "outline"} loading={feeding} onClick={giveFood}>
            <Bone className="h-4 w-4" /> {tr("Dar ração", "Feed")}
          </Button>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <Field label={tr("Nome", "Name")} hint={tr("Salva sozinho ao sair do campo", "Saves when you leave the field")}>
            <Input value={name} maxLength={20} placeholder={tr("Ex.: Thor, Mel, Bolinha", "E.g. Thor, Honey, Buddy")}
              onChange={(e) => setName(e.target.value)} onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} />
          </Field>

          <Field label={tr("Cor do pelo", "Fur color")} group>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DOG_COLORS) as DogColor[]).map((c) => (
                <button key={c} type="button" onClick={() => pet.color !== c && save({ color: c })} aria-pressed={pet.color === c}
                  className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                    pet.color === c ? "border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300")}>
                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: DOG_COLORS[c].body }} />
                  {colorNames()[c]}
                </button>
              ))}
            </div>
          </Field>

          <Field label={tr("Coleira", "Collar")} group>
            <div className="flex flex-wrap items-center gap-2">
              {COLLARS.map((c) => (
                <button key={c} type="button" onClick={() => pet.collar !== c && save({ collar: c })} aria-pressed={pet.collar === c}
                  aria-label={tr(`Coleira ${c}`, `Collar ${c}`)}
                  className={cn(swatch, pet.collar === c && "ring-2 ring-slate-400")} style={{ backgroundColor: c }}>
                  {pet.collar === c && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
              <button type="button" onClick={() => pet.collar !== null && save({ collar: null })} aria-pressed={pet.collar === null}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                  pet.collar === null ? "border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300")}>
                {tr("Sem coleira", "No collar")}
              </button>
            </div>
          </Field>

          <Toggle checked={pet.wander} onChange={(v) => save({ wander: v })} label={tr("Passear sozinho pela tela", "Wander around the screen on its own")} />
        </div>
      </div>

      <ul className="mt-5 space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800">
        <li>{tr("Ele mora na tela do app. Toque nele para fazer carinho e, em seguida, toque em qualquer ponto da tela: ele vai andando até lá.", "It lives on the app screen. Tap it to pet it, then tap anywhere on the screen: it walks there.")}</li>
        <li>{tr("Arraste e solte para deixá-lo em qualquer lugar. Sem ninguém brincar, ele tira uma soneca 💤", "Drag and drop to leave it anywhere. If nobody plays, it takes a nap 💤")}</li>
        <li>{tr("A ração dura umas 8 horas. Com fome, ele avisa quando você abre o app.", "Food lasts about 8 hours. When hungry, it tells you when you open the app.")}</li>
      </ul>
    </Card>
  );
}
