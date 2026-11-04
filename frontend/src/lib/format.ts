import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { addMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let currentCurrency = "BRL";
export function setCurrency(c: string) {
  currentCurrency = c || "BRL";
}

export function money(value: number | null | undefined, opts: { sign?: boolean; compact?: boolean } = {}) {
  const v = Number(value ?? 0);
  const s = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currentCurrency,
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 2,
  }).format(v);
  return opts.sign && v > 0 ? `+${s}` : s;
}

export function percent(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;
}

export function fmtDate(d: string | null | undefined, pattern = "dd/MM/yyyy") {
  if (!d) return "—";
  // Datas puras (YYYY-MM-DD) são tratadas sem fuso; timestamps completos usam o horário local.
  const parsed = d.length > 10 ? new Date(d) : parseISO(d);
  return format(parsed, pattern, { locale: ptBR });
}

export function today() {
  return format(new Date(), "yyyy-MM-dd");
}

export function currentMonth() {
  return format(new Date(), "yyyy-MM");
}

export function shiftMonth(month: string, n: number) {
  return format(addMonths(parseISO(`${month}-01`), n), "yyyy-MM");
}

export function monthLabel(month: string, short = false) {
  const s = format(parseISO(`${month}-01`), short ? "MMM/yy" : "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Converte "1.234,56" ou "1234.56" em número. */
export function parseAmount(input: string | number): number {
  if (typeof input === "number") return input;
  const clean = input.replace(/[^\d,.-]/g, "");
  if (clean.includes(",")) return Number(clean.replace(/\./g, "").replace(",", "."));
  return Number(clean);
}

export const ACCOUNT_TYPES: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  investment: "Investimento",
  other: "Outra",
};

export const PAYMENT_METHODS: Record<string, string> = {
  pix: "Pix",
  debit: "Débito",
  credit: "Crédito",
  cash: "Dinheiro",
  boleto: "Boleto",
  transfer: "Transferência",
  other: "Outro",
};

export const TX_TYPES: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};

export const FREQUENCIES: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

export const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#64748b", "#78716c",
];
