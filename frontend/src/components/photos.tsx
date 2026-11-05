"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, parseError } from "@/lib/api";
import { cn } from "@/lib/format";
import type { User } from "@/lib/types";
import { useAuth } from "@/components/auth";
import { Button, Card } from "@/components/ui";
import { tr } from "@/lib/i18n";

export type PhotoSlot = "avatar" | "cover" | "background";

/** Lugares onde dá para colocar foto. O tamanho máximo vale para o lado maior. */
const slots = (): { slot: PhotoSlot; key: "avatar_url" | "cover_url" | "background_url"; title: string; hint: string; max: number }[] => [
  { slot: "avatar", key: "avatar_url", title: tr("Foto de perfil", "Profile photo"), hint: tr("Aparece no menu e na saudação do Dashboard", "Shown in the menu and in the Dashboard greeting"), max: 600 },
  { slot: "cover", key: "cover_url", title: tr("Capa do Dashboard", "Dashboard cover"), hint: tr("Banner no topo do Dashboard. De preferência uma foto deitada", "Banner at the top of the Dashboard. A landscape photo works best"), max: 1800 },
  { slot: "background", key: "background_url", title: tr("Fundo do app", "App background"), hint: tr("Fica bem clarinha atrás das telas, sem atrapalhar a leitura", "Shown very lightly behind the screens, without hurting readability"), max: 1920 },
];

/**
 * Diminui a foto no próprio aparelho antes de enviar (foto de celular tem 5–12 MB).
 * Vira JPEG com no máximo `max` px no lado maior. GIF vai como está, para não perder a animação.
 */
async function shrink(file: File, max: number): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // formato que o navegador não abre: o servidor valida
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // PNG transparente não fica preto no JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.86));
}

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

/** Foto de perfil redonda; sem foto, mostra as iniciais. */
export function Avatar({ user, className }: { user: User; className?: string }) {
  // Se a foto não carregar (arquivo sumiu), volta para as iniciais.
  const [broken, setBroken] = useState<string | null>(null);
  return user.avatar_url && broken !== user.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar_url} alt="" onError={() => setBroken(user.avatar_url)} className={cn("shrink-0 rounded-full object-cover", className)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-semibold text-white", className)}>
      {initialsOf(user.name)}
    </span>
  );
}

/** Foto de fundo do app, bem lavada para o conteúdo continuar legível. */
export function AppBackground() {
  const { user } = useAuth();
  if (!user?.background_url) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 print:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={user.background_url} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-slate-50/80 dark:bg-slate-950/85" />
    </div>
  );
}

/** Enquadramento padrão da capa: um pouco acima do meio, onde costumam ficar os rostos. */
export const COVER_DEFAULT_POSITION = 35;

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** Prévia da capa: arraste para cima/baixo para escolher a parte da foto que aparece. */
function CoverFramer({ url, position, busy }: { url: string; position: number; busy: boolean }) {
  const { setUser } = useAuth();
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [pos, setPos] = useState(position);
  const [saved, setSaved] = useState(position);
  // Valor novo do servidor (outra foto, outro aparelho): adota.
  if (saved !== position) { setSaved(position); setPos(position); }
  const [range, setRange] = useState(0);
  const drag = useRef<{ y: number; start: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Quanto a foto "sobra" na vertical dentro do quadro (0 = não dá para mover).
  const measure = () => {
    const b = box.current, i = img.current;
    if (!b || !i?.naturalWidth) return 0;
    const r = Math.max(0, (b.clientWidth * i.naturalHeight) / i.naturalWidth - b.clientHeight);
    setRange(r);
    return r;
  };

  const save = async (value: number) => {
    if (value === position) return;
    try {
      const { data } = await api.patch<{ user: User }>("/profile/photos/cover/position", { position: value });
      setUser(data.user);
      toast.success(tr("Enquadramento salvo 📸", "Framing saved 📸"));
    } catch (err) {
      setPos(position);
      toast.error(parseError(err).message);
    }
  };

  return (
    <div ref={box}
      onPointerDown={(e) => {
        if (measure() < 2) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, start: pos };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) setPos(clamp(d.start - ((e.clientY - d.y) / range) * 100));
      }}
      onPointerUp={() => {
        if (!drag.current) return;
        drag.current = null;
        setDragging(false);
        void save(Math.round(pos));
      }}
      className={cn("relative aspect-[11/4] w-full touch-none overflow-hidden rounded-xl bg-slate-100 select-none dark:bg-slate-800", range >= 2 && (dragging ? "cursor-grabbing" : "cursor-grab"))}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={url} alt="" draggable={false} onLoad={measure}
        className="pointer-events-none h-full w-full object-cover" style={{ objectPosition: `50% ${pos}%` }} />
      {range >= 2 && !busy && (
        <span className={cn("pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-slate-950/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur transition-opacity", dragging && "opacity-0")}>
          {tr("↕ Arraste para ajustar", "↕ Drag to adjust")}
        </span>
      )}
      {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium text-brand-600 dark:bg-slate-900/70">{tr("Enviando…", "Uploading…")}</span>}
    </div>
  );
}

function PhotoTile({ slot, title, hint, max, url, position }: { slot: PhotoSlot; title: string; hint: string; max: number; url: string | null; position?: number | null }) {
  const { setUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"up" | "del" | null>(null);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher a mesma foto de novo
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error(tr("Escolha um arquivo de imagem", "Choose an image file"));
    setBusy("up");
    try {
      const blob = await shrink(file, max);
      const form = new FormData();
      form.append("photo", blob, blob === file ? file.name : `${slot}.jpg`);
      const { data } = await api.post<{ user: User }>(`/profile/photos/${slot}`, form);
      setUser(data.user);
      toast.success(tr(`${title} atualizada 💕`, `${title} updated 💕`));
    } catch (err) {
      toast.error(parseError(err).message);
    } finally { setBusy(null); }
  };

  const remove = async () => {
    setBusy("del");
    try {
      const { data } = await api.delete<{ user: User }>(`/profile/photos/${slot}`);
      setUser(data.user);
      toast.success(tr(`${title} removida`, `${title} removed`));
    } catch (err) {
      toast.error(parseError(err).message);
    } finally { setBusy(null); }
  };

  const preview = slot === "avatar"
    ? "mx-auto aspect-square w-24 rounded-full"
    : slot === "cover" ? "aspect-[3/1] w-full rounded-xl" : "aspect-video w-full rounded-xl";

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
      {slot === "cover" && url ? (
        <CoverFramer url={url} position={position ?? COVER_DEFAULT_POSITION} busy={busy === "up"} />
      ) : (
      <button type="button" onClick={() => input.current?.click()} disabled={!!busy}
        className={cn("group relative overflow-hidden border-2 border-dashed border-brand-200 bg-brand-50/60 transition hover:border-brand-400 dark:border-brand-500/30 dark:bg-brand-500/5", url && "border-solid border-transparent", preview)}
        aria-label={url ? tr(`Trocar ${title.toLowerCase()}`, `Change ${title.toLowerCase()}`) : tr(`Escolher ${title.toLowerCase()}`, `Choose ${title.toLowerCase()}`)}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-medium text-brand-500">
            <ImagePlus className="h-6 w-6" /> {slot === "avatar" ? "" : tr("Escolher foto", "Choose photo")}
          </span>
        )}
        {busy === "up" && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium text-brand-600 dark:bg-slate-900/70">{tr("Enviando…", "Uploading…")}</span>}
      </button>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} loading={busy === "up"} disabled={!!busy}>
          <ImagePlus className="h-4 w-4" /> {url ? tr("Trocar", "Change") : tr("Escolher", "Choose")}
        </Button>
        {url && (
          <Button size="sm" variant="ghost" onClick={remove} loading={busy === "del"} disabled={!!busy}>
            <Trash2 className="h-4 w-4" /> {tr("Remover", "Remove")}
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} />
    </div>
  );
}

/** Card do Perfil com todos os lugares de foto. */
export function PhotosCard({ className }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Card title={tr("Nossas fotos 📸", "Our photos 📸")} className={className}>
      <div className="grid gap-3 sm:grid-cols-3">
        {slots().map((s) => <PhotoTile key={s.slot} slot={s.slot} title={s.title} hint={s.hint} max={s.max} url={user[s.key] ?? null} position={s.slot === "cover" ? user.cover_position : undefined} />)}
      </div>
      <p className="mt-3 text-xs text-slate-500">{tr("As fotos ficam guardadas no servidor do app e só aparecem para quem está logado nesta conta.", "Photos are stored on the app's server and only shown to whoever is signed in to this account.")}</p>
    </Card>
  );
}
