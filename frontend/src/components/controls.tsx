"use client";

/**
 * Controles de formulário personalizados (substituem os nativos do navegador):
 * Select, DatePicker, MonthPicker, Checkbox e NumberStepper.
 *
 * Os painéis abrem num portal com posição fixa, então não são cortados por
 * modais com rolagem, e viram para cima quando falta espaço abaixo.
 */

import {
  Children, Fragment, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type ReactElement, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  addDays, addMonths, format, isSameDay, isSameMonth, isValid, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Search } from "lucide-react";
import { cn } from "@/lib/format";

const triggerBase =
  "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-base sm:text-sm text-slate-900 transition hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600";
const panelBase =
  "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40";
const openRing = "border-brand-500 ring-2 ring-brand-500/20 dark:border-brand-500";

/* ================================ Popover ================================ */

export function usePopover<T extends HTMLElement>(opts: { matchWidth?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Posiciona o painel direto no DOM (sem re-render) a partir da âncora.
  const place = useCallback(() => {
    const a = anchorRef.current;
    const p = panelRef.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    if (opts.matchWidth) p.style.minWidth = `${r.width}px`;
    const h = p.offsetHeight;
    const w = p.offsetWidth;
    const below = window.innerHeight - r.bottom;
    const up = below < h + 12 && r.top > below;
    p.style.top = `${up ? Math.max(8, r.top - h - 6) : r.bottom + 6}px`;
    p.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
    p.style.transformOrigin = up ? "bottom" : "top";
    p.style.visibility = "visible";
  }, [opts.matchWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, place]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) anchorRef.current?.focus();
  }, []);

  return { open, setOpen, close, anchorRef, panelRef, place };
}

/**
 * Painel flutuante. No celular (< 640px) vira uma folha que sobe de baixo, como nos apps:
 * as classes `max-sm:!...` vencem o posicionamento calculado (estilo inline).
 */
export function PopoverPanel({ panelRef, children, className }: { panelRef: RefObject<HTMLDivElement | null>; children: ReactNode; className?: string }) {
  return createPortal(
    <>
      {/* Fundo escurecido só no celular; tocar nele fecha (é "fora" do painel). */}
      <div className="fixed inset-0 z-[69] animate-[fade-in_.2s_ease-out] bg-slate-950/40 sm:hidden" aria-hidden />
      <div ref={panelRef} style={{ position: "fixed", top: 0, left: 0, visibility: "hidden", zIndex: 70 }}
        className={cn(
          panelBase, "animate-[pop_120ms_ease-out]", className,
          "max-sm:!top-auto max-sm:!right-0 max-sm:!bottom-0 max-sm:!left-0 max-sm:!w-full max-sm:!max-w-none max-sm:!min-w-0",
          "max-sm:max-h-[80vh] max-sm:overflow-y-auto max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:border-b-0",
          "max-sm:animate-[sheet-up_.25s_cubic-bezier(.2,.8,.2,1)] max-sm:pb-[env(safe-area-inset-bottom)] max-sm:[&>*]:mx-auto",
        )}>
        <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" aria-hidden />
        {children}
      </div>
    </>,
    document.body,
  );
}

/* ================================= Select ================================= */

interface Opt { value: string; label: ReactNode; text: string; color?: string; disabled?: boolean; group?: string }

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean; "data-color"?: string };
type GroupProps = { label?: string; children?: ReactNode };

/** Lê os <option>/<optgroup> filhos, mantendo a mesma marcação do <select> nativo. */
function parseOptions(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  const walk = (nodes: ReactNode, group?: string) =>
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      const el = child as ReactElement<OptionProps & GroupProps>;
      if (el.type === "optgroup") walk(el.props.children, el.props.label);
      else if (el.type === Fragment) walk(el.props.children, group);
      else if (el.type === "option") {
        const text = textOf(el.props.children);
        out.push({ value: String(el.props.value ?? text), label: el.props.children, text, color: el.props["data-color"], disabled: el.props.disabled, group });
      }
    });
  walk(children);
  return out;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type SelectChange = { target: { value: string } };

export interface SelectProps {
  value?: string | number | null;
  onChange?: (e: SelectChange) => void;
  children?: ReactNode;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Mostra o campo de busca. Padrão: automático acima de 8 opções. */
  searchable?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

export function Select({ value, onChange, children, className, invalid, disabled, required, searchable, placeholder = "Selecione", ...rest }: SelectProps) {
  const options = useMemo(() => parseOptions(children), [children]);
  const current = String(value ?? "");
  const selected = options.find((o) => o.value === current);
  const { open, setOpen, close, anchorRef, panelRef } = usePopover<HTMLButtonElement>({ matchWidth: true });
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const showSearch = searchable ?? options.length > 8;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((o) => normalize(o.text).includes(q)) : options;
  }, [options, query]);

  const openList = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  // Foco inicial e rolagem até o item ativo.
  useEffect(() => {
    if (!open) return;
    // No celular não foca a busca: o teclado subiria cobrindo a lista (toque na busca para digitar).
    const mobile = window.matchMedia("(max-width: 639px)").matches;
    (showSearch && !mobile ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
  }, [open, showSearch]);
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (o: Opt) => {
    if (o.disabled) return;
    if (o.value !== current) onChange?.({ target: { value: o.value } });
    close();
  };

  const move = (delta: number) => {
    if (!filtered.length) return;
    let i = active;
    for (let n = 0; n < filtered.length; n++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (!filtered[i].disabled) break;
    }
    setActive(i);
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const onListKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); move(1); break;
      case "ArrowUp": e.preventDefault(); move(-1); break;
      case "Home": if (!showSearch) { e.preventDefault(); setActive(0); } break;
      case "End": if (!showSearch) { e.preventDefault(); setActive(filtered.length - 1); } break;
      case "Enter": e.preventDefault(); if (filtered[active]) choose(filtered[active]); break;
      case "Escape": e.preventDefault(); e.stopPropagation(); close(); break;
      case "Tab": close(false); break;
      default:
        // Sem busca: digitar pula para o item que começa com o texto.
        if (!showSearch && e.key.length === 1) {
          const now = Date.now();
          const t = typeahead.current;
          t.text = now - t.at < 600 ? t.text + e.key.toLowerCase() : e.key.toLowerCase();
          t.at = now;
          const i = filtered.findIndex((o) => normalize(o.text).startsWith(normalize(t.text)));
          if (i >= 0) setActive(i);
        }
    }
  };


  return (
    <>
      <button ref={anchorRef} type="button" disabled={disabled} onClick={() => (open ? close() : openList())} onKeyDown={onTriggerKey}
        aria-haspopup="listbox" aria-expanded={open} aria-label={rest["aria-label"]}
        className={cn(triggerBase, open && openRing, invalid && "border-rose-500", className)}>
        {selected?.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />}
        <span className={cn("min-w-0 flex-1 truncate", (!selected || selected.value === "") && "text-slate-500 dark:text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {required && (
        <input tabIndex={-1} aria-hidden required value={current} onChange={() => {}}
          onFocus={() => anchorRef.current?.focus()} className="pointer-events-none absolute h-0 w-0 opacity-0" />
      )}
      {open && (
        <PopoverPanel panelRef={panelRef} className="max-w-[min(24rem,calc(100vw-16px))]">
          {showSearch && (
            <div className="relative border-b border-slate-100 p-2 dark:border-slate-800">
              <Search className="absolute top-1/2 left-4.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input ref={searchRef} value={query} onKeyDown={onListKey} placeholder="Buscar..."
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                className="h-9 w-full rounded-lg bg-slate-50 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:bg-slate-800 dark:text-slate-100" />
            </div>
          )}
          <ul ref={listRef} role="listbox" tabIndex={-1} onKeyDown={onListKey} className="max-h-72 overflow-y-auto p-1 focus:outline-none">
            {filtered.map((o, i) => {
              const header = o.group && o.group !== filtered[i - 1]?.group ? o.group : null;
              const isSel = o.value === current;
              return (
                <Fragment key={`${o.group ?? ""}-${o.value}`}>
                  {header && <li role="presentation" className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{header}</li>}
                  <li role="option" aria-selected={isSel} aria-disabled={o.disabled} data-index={i}
                    onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 select-none dark:text-slate-200",
                      i === active && "bg-slate-100 dark:bg-slate-800",
                      isSel && "font-medium text-brand-700 dark:text-brand-300",
                      o.disabled && "cursor-not-allowed opacity-40",
                    )}>
                    {o.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />}
                    <span className={cn("min-w-0 flex-1 truncate", o.value === "" && !isSel && "text-slate-500")}>{o.label}</span>
                    {isSel && <Check className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />}
                  </li>
                </Fragment>
              );
            })}
            {!filtered.length && <li className="px-3 py-6 text-center text-sm text-slate-400">Nenhum resultado</li>}
          </ul>
        </PopoverPanel>
      )}
    </>
  );
}

/* ============================ Grade de meses ============================ */

const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), "MMM", { locale: ptBR }).replace(".", ""));

function MonthGrid({ year, selected, onYear, onPick }: { year: number; selected?: { y: number; m: number }; onYear: (y: number) => void; onPick: (m: number) => void }) {
  const now = new Date();
  return (
    <div className="w-72 p-3">
      <div className="mb-3 flex items-center justify-between">
        <NavBtn label="Ano anterior" onClick={() => onYear(year - 1)}><ChevronLeft className="h-4 w-4" /></NavBtn>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{year}</span>
        <NavBtn label="Próximo ano" onClick={() => onYear(year + 1)}><ChevronRight className="h-4 w-4" /></NavBtn>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MONTHS.map((label, m) => {
          const isSel = selected?.y === year && selected.m === m;
          const isNow = now.getFullYear() === year && now.getMonth() === m;
          return (
            <button key={m} type="button" onClick={() => onPick(m)}
              className={cn(
                "h-10 rounded-lg text-sm capitalize transition",
                isSel ? "bg-brand-600 font-semibold text-white" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                !isSel && isNow && "ring-1 ring-brand-500/50 ring-inset",
              )}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
      {children}
    </button>
  );
}

/* =============================== DatePicker =============================== */

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const toISO = (d: Date) => format(d, "yyyy-MM-dd");
const parse = (v?: string | null) => {
  if (!v) return null;
  const d = parseISO(v.slice(0, 10));
  return isValid(d) ? d : null;
};

export interface DatePickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function DatePicker({ value, onChange, placeholder = "Selecione a data", clearable, invalid, disabled, className, ...rest }: DatePickerProps) {
  const selected = parse(value);
  const { open, setOpen, close, anchorRef, panelRef, place } = usePopover<HTMLButtonElement>();
  const [view, setView] = useState(() => startOfMonth(selected ?? new Date()));
  const [focusDay, setFocusDay] = useState<Date>(() => selected ?? new Date());
  const [mode, setMode] = useState<"days" | "months">("days");
  const gridRef = useRef<HTMLDivElement>(null);

  const openPicker = () => {
    if (disabled) return;
    const base = selected ?? new Date();
    setView(startOfMonth(base));
    setFocusDay(base);
    setMode("days");
    setOpen(true);
  };

  useEffect(() => { if (open && mode === "days") gridRef.current?.focus({ preventScroll: true }); }, [open, mode]);
  // A altura muda entre dias/meses: reposiciona.
  useLayoutEffect(() => { if (open) place(); }, [open, mode, view, place]);

  const pick = (d: Date) => {
    onChange(toISO(d));
    close();
  };

  const moveFocus = (d: Date) => {
    setFocusDay(d);
    if (!isSameMonth(d, view)) setView(startOfMonth(d));
  };

  const onGridKey = (e: KeyboardEvent) => {
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      PageUp: () => addMonths(focusDay, -1),
      PageDown: () => addMonths(focusDay, 1),
    };
    if (map[e.key]) { e.preventDefault(); moveFocus(map[e.key]()); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(focusDay); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  };

  const start = startOfWeek(view, { weekStartsOn: 0 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = new Date();

  return (
    <>
      <button ref={anchorRef} type="button" disabled={disabled} onClick={() => (open ? close() : openPicker())}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); openPicker(); } }}
        aria-haspopup="dialog" aria-expanded={open} aria-label={rest["aria-label"]}
        className={cn(triggerBase, open && openRing, invalid && "border-rose-500", className)}>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        <span className={cn("tabular min-w-0 flex-1 truncate", !selected && "text-slate-500 dark:text-slate-400")}>
          {selected ? format(selected, "dd/MM/yyyy") : placeholder}
        </span>
        {selected && <span className="hidden text-xs text-slate-400 capitalize sm:inline">{format(selected, "EEE", { locale: ptBR }).replace(".", "")}</span>}
      </button>
      {open && (
        <PopoverPanel panelRef={panelRef}>
          {mode === "months" ? (
            <MonthGrid year={view.getFullYear()} selected={selected ? { y: selected.getFullYear(), m: selected.getMonth() } : undefined}
              onYear={(y) => setView(new Date(y, view.getMonth(), 1))}
              onPick={(m) => { const v = new Date(view.getFullYear(), m, 1); setView(v); setFocusDay(v); setMode("days"); }} />
          ) : (
            <div className="w-72 p-3">
              <div className="mb-2 flex items-center justify-between">
                <NavBtn label="Mês anterior" onClick={() => setView(addMonths(view, -1))}><ChevronLeft className="h-4 w-4" /></NavBtn>
                <button type="button" onClick={() => setMode("months")} className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-900 capitalize hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800">
                  {format(view, "MMMM yyyy", { locale: ptBR })}
                </button>
                <NavBtn label="Próximo mês" onClick={() => setView(addMonths(view, 1))}><ChevronRight className="h-4 w-4" /></NavBtn>
              </div>
              <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400">
                {WEEKDAYS.map((w, i) => <span key={i} className="py-1">{w}</span>)}
              </div>
              <div ref={gridRef} tabIndex={0} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5 rounded-lg focus:outline-none">
                {days.map((d) => {
                  const isSel = selected && isSameDay(d, selected);
                  const isToday = isSameDay(d, today);
                  const inMonth = isSameMonth(d, view);
                  const isFocus = isSameDay(d, focusDay);
                  return (
                    <button key={d.toISOString()} type="button" tabIndex={-1} onClick={() => pick(d)} onMouseDown={(e) => e.preventDefault()}
                      aria-label={format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR })} aria-pressed={!!isSel}
                      className={cn(
                        "tabular relative flex h-9 items-center justify-center rounded-lg text-sm transition",
                        isSel ? "bg-brand-600 font-semibold text-white" : inMonth ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" : "text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800/50",
                        isFocus && !isSel && "ring-2 ring-brand-500/40 ring-inset",
                      )}>
                      {d.getDate()}
                      {isToday && <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", isSel ? "bg-white" : "bg-brand-500")} />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                <button type="button" onClick={() => pick(new Date())} className="rounded-lg px-2 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10">Hoje</button>
                {clearable && selected && (
                  <button type="button" onClick={() => { onChange(""); close(); }} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Limpar</button>
                )}
              </div>
            </div>
          )}
        </PopoverPanel>
      )}
    </>
  );
}

/* =============================== MonthPicker =============================== */

export function MonthPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const [y, m] = value.split("-").map(Number);
  const { open, setOpen, close, anchorRef, panelRef } = usePopover<HTMLButtonElement>();
  const [year, setYear] = useState(y);
  const shift = (n: number) => onChange(format(addMonths(new Date(y, m - 1, 1), n), "yyyy-MM"));
  const raw = format(new Date(y, m - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
  const label = raw.charAt(0).toUpperCase() + raw.slice(1); // "Novembro de 2026"

  return (
    <div className="inline-flex h-10 items-stretch rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button type="button" onClick={() => shift(-1)} aria-label="Mês anterior" className="flex items-center rounded-l-lg px-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button ref={anchorRef} type="button" onClick={() => { if (open) close(); else { setYear(y); setOpen(true); } }}
        aria-haspopup="dialog" aria-expanded={open}
        className={cn("flex min-w-40 items-center justify-center gap-2 px-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800", open && "bg-slate-50 dark:bg-slate-800")}>
        <CalendarDays className="h-4 w-4 text-slate-400" />
        {label}
      </button>
      <button type="button" onClick={() => shift(1)} aria-label="Próximo mês" className="flex items-center rounded-r-lg px-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
        <ChevronRight className="h-4 w-4" />
      </button>
      {open && (
        <PopoverPanel panelRef={panelRef}>
          <div onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
            <MonthGrid year={year} selected={{ y, m: m - 1 }} onYear={setYear}
              onPick={(mm) => { onChange(`${year}-${String(mm + 1).padStart(2, "0")}`); close(); }} />
            <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
              <button type="button" onClick={() => { onChange(format(new Date(), "yyyy-MM")); close(); }} className="rounded-lg px-2 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10">Mês atual</button>
            </div>
          </div>
        </PopoverPanel>
      )}
    </div>
  );
}

/* ================================ Checkbox ================================ */

export function Checkbox({ checked, onChange, label, indeterminate, className, ...rest }: {
  checked: boolean; onChange: (checked: boolean) => void; label?: ReactNode; indeterminate?: boolean; className?: string; "aria-label"?: string;
}) {
  const on = checked || indeterminate;
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 select-none dark:text-slate-300", className)}>
      <span className="relative inline-flex">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={rest["aria-label"]}
          className={cn(
            "peer h-4.5 w-4.5 cursor-pointer appearance-none rounded-[5px] border border-slate-300 bg-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-600 dark:bg-slate-900",
            on && "border-brand-600 bg-brand-600 dark:border-brand-500 dark:bg-brand-500",
          )} />
        {indeterminate && !checked
          ? <Minus className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white" strokeWidth={3} />
          : <Check className={cn("pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white transition", checked ? "scale-100 opacity-100" : "scale-50 opacity-0")} strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

/* =============================== MoneyInput =============================== */

const plain = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Campo de valor com máscara de moeda, estilo app de banco: os dígitos entram
 * pela direita (1 → 0,01 → 0,12 → 1,23). Aceita negativo com "-" quando permitido.
 * `value` aceita "1.234,56", "1234,56" ou "1234.56"; `onChange` devolve o texto
 * formatado ("1.234,56") e o número.
 */
export function MoneyInput({ value, onChange, allowNegative, invalid, className, placeholder, autoFocus, required, currency = "BRL", ...rest }: {
  value: string | number | null | undefined;
  onChange: (formatted: string, numeric: number | null) => void;
  allowNegative?: boolean;
  invalid?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  currency?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const num = (() => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return value;
    const s = value.replace(/[^\d,.-]/g, "");
    const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
    return Number.isFinite(n) ? n : null;
  })();
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency });
  const display = num === null ? "" : fmt.format(num);

  const toEnd = () => requestAnimationFrame(() => {
    const el = ref.current;
    if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
  });

  return (
    <input ref={ref} inputMode="numeric" autoComplete="off" autoFocus={autoFocus} required={required} aria-label={rest["aria-label"]}
      value={display}
      placeholder={placeholder ?? fmt.format(0)}
      onFocus={toEnd} onClick={toEnd}
      onKeyDown={(e) => {
        // Com valor zerado, "-" ainda não tem dígitos para negativar: guarda como -0,00.
        if (allowNegative && e.key === "-" && (num === null || num === 0)) { e.preventDefault(); onChange("-0,00", -0); }
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const negative = !!allowNegative && raw.includes("-");
        const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13);
        if (!digits) {
          onChange(negative ? "-0,00" : "", negative ? -0 : null);
        } else {
          const n = (Number(digits) / 100) * (negative ? -1 : 1);
          onChange(plain(n), n);
        }
        toEnd();
      }}
      className={cn(
        "tabular h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
        num !== null && num < 0 && "text-rose-600 dark:text-rose-400",
        invalid && "border-rose-500",
        className,
      )} />
  );
}

/* ============================== NumberStepper ============================== */

export function NumberStepper({ value, onChange, min = 0, max = 9999, suffix, className }: {
  value: number | string; onChange: (value: number) => void; min?: number; max?: number; suffix?: string; className?: string;
}) {
  const n = Number(value) || min;
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  const btn = "flex w-10 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-white";
  return (
    <div className={cn("flex h-10 items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900", className)}>
      <button type="button" onClick={() => set(n - 1)} disabled={n <= min} className={btn} aria-label="Diminuir"><Minus className="h-4 w-4" /></button>
      <div className="flex flex-1 items-center justify-center gap-1 border-x border-slate-200 dark:border-slate-700">
        <input inputMode="numeric" value={value} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); if (d === "") onChange(min); else set(Number(d)); }}
          onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); set(n + 1); } if (e.key === "ArrowDown") { e.preventDefault(); set(n - 1); } }}
          className="tabular w-12 bg-transparent text-center text-sm font-medium text-slate-900 focus:outline-none dark:text-slate-100" />
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </div>
      <button type="button" onClick={() => set(n + 1)} disabled={n >= max} className={btn} aria-label="Aumentar"><Plus className="h-4 w-4" /></button>
    </div>
  );
}
