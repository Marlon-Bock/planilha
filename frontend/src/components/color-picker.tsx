"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Pipette } from "lucide-react";
import { cn, COLORS } from "@/lib/format";
import { PopoverPanel, usePopover } from "@/components/controls";

/* ------------------------------ Conversões ------------------------------ */

type HSV = { h: number; s: number; v: number };

function hexToHsv(hex: string): HSV {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { h: 240, s: 0.6, v: 0.9 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: HSV): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** Hook de arrastar: chama `onMove` com a posição relativa (0..1) dentro do elemento. */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const update = (e: ReactPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    onMove(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };
  return {
    ref,
    onPointerDown: (e: ReactPointerEvent) => { e.preventDefault(); ref.current!.setPointerCapture(e.pointerId); update(e); },
    onPointerMove: (e: ReactPointerEvent) => { if (ref.current!.hasPointerCapture(e.pointerId)) update(e); },
  };
}

/* ------------------------------ Componente ------------------------------ */

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const isPreset = COLORS.includes(value.toLowerCase());
  const { open, setOpen, close, anchorRef, panelRef } = usePopover<HTMLButtonElement>();
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const [hexText, setHexText] = useState(value);

  const apply = (next: HSV) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexText(hex);
    onChange(hex);
  };

  const sv = useDrag((x, y) => apply({ ...hsv, s: x, v: 1 - y }));
  const hue = useDrag((x) => apply({ ...hsv, h: x * 360 }));

  const openCustom = () => {
    setHsv(hexToHsv(value));
    setHexText(value);
    setOpen(true);
  };

  // Máscara do hex: só 0-9/a-f, sempre com "#", máximo 6 dígitos.
  const onHex = (raw: string) => {
    const t = `#${raw.replace(/[^0-9a-f]/gi, "").slice(0, 6)}`.toLowerCase();
    setHexText(t);
    if (isHex(t)) { setHsv(hexToHsv(t)); onChange(t); }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={`Cor ${c}`}
          className={cn("flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110 dark:ring-offset-slate-900", value.toLowerCase() === c && "ring-2 ring-slate-400")}
          style={{ backgroundColor: c }}>
          {value.toLowerCase() === c && <Check className="h-4 w-4 text-white" />}
        </button>
      ))}
      <button ref={anchorRef} type="button" onClick={() => (open ? close() : openCustom())} title="Escolher qualquer cor" aria-label="Cor personalizada"
        className={cn("relative flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110 dark:ring-offset-slate-900", (!isPreset || open) && "ring-2 ring-slate-400")}
        style={{ background: isPreset ? "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" : value }}>
        {isPreset ? <Pipette className="h-3.5 w-3.5 text-white drop-shadow" /> : <Check className="h-4 w-4 text-white" />}
      </button>

      {open && (
        <PopoverPanel panelRef={panelRef}>
          <div className="w-64 space-y-3 p-3" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
            {/* Saturação (x) e brilho (y) */}
            <div {...sv} className="relative h-40 cursor-crosshair touch-none rounded-lg"
              style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)`, backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)" }}>
              <span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.3)]"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hsvToHex(hsv) }} />
            </div>
            {/* Matiz */}
            <div {...hue} className="relative h-3 cursor-pointer touch-none rounded-full"
              style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}>
              <span className="pointer-events-none absolute top-1/2 h-4.5 w-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.3)]"
                style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: `hsl(${hsv.h} 100% 50%)` }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700" style={{ backgroundColor: isHex(hexText) ? hexText : value }} />
              <input value={hexText} onChange={(e) => onHex(e.target.value)} maxLength={7} spellCheck={false} placeholder="#000000" aria-label="Código hexadecimal"
                className={cn("tabular h-9 w-full rounded-lg border bg-white px-3 font-mono text-sm uppercase text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:bg-slate-900 dark:text-slate-100",
                  isHex(hexText) ? "border-slate-300 focus:border-brand-500 dark:border-slate-700" : "border-rose-500")} />
            </div>
            <button type="button" onClick={() => close()} className="h-9 w-full rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700">Usar esta cor</button>
          </div>
        </PopoverPanel>
      )}
    </div>
  );
}
