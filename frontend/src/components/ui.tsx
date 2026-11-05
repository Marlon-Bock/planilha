"use client";

import { Children, forwardRef, Fragment, isValidElement, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/format";
import { Heart, HeartSpinner, SleepyCat } from "@/components/cute";

/* ---------------------------------- Botão ---------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  outline: "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "icon"; loading?: boolean }>(
  function Button({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" && "h-8 px-3 text-sm",
          size === "md" && "h-10 px-4 text-sm",
          size === "icon" && "h-9 w-9",
          variants[variant],
          className,
        )}
        {...props}
      >
        {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);

/* --------------------------------- Campos ---------------------------------- */

const fieldBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-10", invalid && "border-rose-500", className)} {...props} />;
});

// Controles personalizados (substituem select, date, month, checkbox e number nativos).
export { Checkbox, DatePicker, MoneyInput, MonthPicker, NumberStepper, Select } from "@/components/controls";
export { ColorPicker } from "@/components/color-picker";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-20 py-2", className)} {...props} />;
});

/**
 * Rótulo + campo + erro/dica. Use `group` quando o conteúdo for um conjunto de
 * botões (cores, ícones): um <label> ativaria o primeiro botão ao clicar no texto.
 */
export function Field({ label, error, hint, children, className, group }: { label?: string; error?: string; hint?: string; children: ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={cn("block space-y-1.5", className)} {...(group ? { role: "group", "aria-label": label } : {})}>
      {label && <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      {children}
      {error ? <span className="block text-xs text-rose-600">{error}</span> : hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </Tag>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}


/* ----------------------------- Layout / exibição ----------------------------- */

export function Card({ className, children, title, action, padded = true }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <h2 className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div>
        <h1 className="text-[1.6rem] leading-tight font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {/* No celular as ações rolam de lado numa linha (sem quebrar em várias linhas). */}
      {actions && <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">{actions}</div>}
    </div>
  );
}

/** Achata arrays e fragmentos (<>...</>) para cada cartão virar um item do carrossel. */
function flattenChildren(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).flatMap((n) =>
    isValidElement<{ children?: ReactNode }>(n) && n.type === Fragment ? flattenChildren(n.props.children) : [n],
  );
}

/**
 * Carrossel de cartões no celular (deslizar de lado, com "encaixe"), grade a partir de 640px.
 * Use `className` para as colunas da grade (ex.: "sm:grid-cols-2 xl:grid-cols-4").
 */
export function Carousel({ children, className, itemClassName }: { children: ReactNode; className?: string; itemClassName?: string }) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 sm:mx-0 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0", className)}>
      {flattenChildren(children).map((child, i) => (
        <div key={isValidElement(child) && child.key != null ? child.key : i} className={cn("w-[78%] shrink-0 snap-start sm:w-auto", itemClassName)}>{child}</div>
      ))}
    </div>
  );
}

const badgeTones = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
};
export function Badge({ tone = "slate", children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", badgeTones[tone], className)}>{children}</span>;
}

export function Dot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: color ?? "#94a3b8" }} />;
}

/** Barra de progresso. `heart`: coraçãozinho na ponta (metas, no modo fofinho). */
export function Progress({ value, color, className, heart }: { value: number; color?: string; className?: string; heart?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  const auto = value >= 100 ? "#e11d48" : value >= 80 ? "#f59e0b" : "#10b981";
  return (
    <div className="relative">
      <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800", className)}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, backgroundColor: color ?? auto }} />
      </div>
      {heart && v > 0 && (
        <Heart className="pointer-events-none absolute top-1/2 hidden h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_1.5px_white] animate-heartbeat cute:block dark:drop-shadow-[0_0_1.5px_#171717]"
          style={{ left: `${Math.min(v, 98)}%`, color: color ?? auto }} />
      )}
    </div>
  );
}

/** Hover "fofinho" para cards pequenos: flutua de leve com brilho rosa (só no modo fofinho). */
export const cuteHover =
  "transition duration-200 cute:hover:-translate-y-0.5 cute:hover:border-brand-200 cute:hover:shadow-lg cute:hover:shadow-brand-500/10 dark:cute:hover:border-brand-500/30";

export function Spinner({ className }: { className?: string }) {
  return <HeartSpinner className={className} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800", className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {/* Modo fofinho: um gatinho dormindo; sem ele, o ícone da tela. */}
      <SleepyCat seed={title} className="mb-2" />
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400 cute:hidden dark:bg-slate-800">{icon}</div>}
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* --------------------------------- Modal ---------------------------------- */

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-[fade-in_.2s_ease-out] bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          // Celular: folha que sobe de baixo (como nos apps); computador: janela central.
          "relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-2xl dark:bg-slate-900",
          "max-sm:animate-[sheet-up_.28s_cubic-bezier(.2,.8,.2,1)] sm:animate-[pop_150ms_ease-out]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-xl",
          size === "lg" && "sm:max-w-3xl",
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" aria-hidden />
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 sm:py-4 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] max-sm:[&>*]:h-11 max-sm:[&>*]:flex-1 sm:pb-3 dark:border-slate-800">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirmar", loading, tone = "danger", children }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: ReactNode; confirmLabel?: string; loading?: boolean; tone?: "danger" | "primary"; children?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant={tone} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">{message}{children}</div>
    </Modal>
  );
}

/* --------------------------- Multi seleção (dropdown) --------------------------- */

export function MultiSelect<T extends { id: number; name: string; color?: string }>({ label, options, value, onChange }: {
  label: string; options: T[]; value: number[]; onChange: (v: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={cn(fieldBase, "flex h-10 items-center justify-between gap-2 text-left", value.length && "border-brand-500")}>
        <span className="truncate">{value.length ? `${label} (${value.length})` : label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {value.length > 0 && (
            <button className="w-full rounded-md px-2 py-1.5 text-left text-xs text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => onChange([])}>
              Limpar seleção
            </button>
          )}
          {options.map((o) => (
            <button key={o.id} type="button" onClick={() => toggle(o.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className={cn("flex h-4 w-4 items-center justify-center rounded border", value.includes(o.id) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-slate-600")}>
                {value.includes(o.id) && <Check className="h-3 w-3" />}
              </span>
              {o.color && <Dot color={o.color} />}
              <span className="truncate text-slate-700 dark:text-slate-200">{o.name}</span>
            </button>
          ))}
          {!options.length && <p className="px-2 py-3 text-center text-xs text-slate-500">Nada para mostrar</p>}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Paginação -------------------------------- */

export function Pagination({ page, lastPage, onChange }: { page: number; lastPage: number; onChange: (p: number) => void }) {
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-slate-600 dark:text-slate-400">Página {page} de {lastPage}</span>
      <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onChange(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}
