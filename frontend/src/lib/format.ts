import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { addMonths, format, parseISO } from "date-fns";
import { dateLocale, intlLocale, isEn, tr } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let currentCurrency = "BRL";
export function setCurrency(c: string) {
  currentCurrency = c || "BRL";
}

export function money(value: number | null | undefined, opts: { sign?: boolean; compact?: boolean } = {}) {
  const v = Number(value ?? 0);
  const s = new Intl.NumberFormat(intlLocale(), {
    style: "currency",
    currency: currentCurrency,
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 2,
  }).format(v);
  return opts.sign && v > 0 ? `+${s}` : s;
}

export function percent(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString(intlLocale(), { maximumFractionDigits: digits })}%`;
}

export function fmtDate(d: string | null | undefined, pattern = "dd/MM/yyyy") {
  if (!d) return "—";
  // Datas puras (YYYY-MM-DD) são tratadas sem fuso; timestamps completos usam o horário local.
  const parsed = d.length > 10 ? new Date(d) : parseISO(d);
  return format(parsed, localPattern(pattern), { locale: dateLocale() });
}

/** Em inglês: mês antes do dia e sem o "de"/"às" do português. */
export function localPattern(pattern: string) {
  if (!isEn()) return pattern;
  return pattern
    .replace("dd/MM/yyyy", "MM/dd/yyyy")
    .replace(/dd\/MM(?!\/)/, "MM/dd")
    .replace(/ 'de' /g, " ")
    .replace("'às'", "'at'");
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
  const s = format(parseISO(`${month}-01`), short ? "MMM/yy" : localPattern("MMMM 'de' yyyy"), { locale: dateLocale() });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Converte "1.234,56" ou "1234.56" em número. */
export function parseAmount(input: string | number): number {
  if (typeof input === "number") return input;
  const clean = input.replace(/[^\d,.-]/g, "");
  if (clean.includes(",")) return Number(clean.replace(/\./g, "").replace(",", "."));
  return Number(clean);
}

/**
 * Mapa de rótulos que se traduz sozinho: ACCOUNT_TYPES.checking devolve o texto no
 * idioma atual (funciona também com Object.entries/keys).
 */
function labels(map: Record<string, [string, string]>): Record<string, string> {
  return new Proxy(map as unknown as Record<string, string>, {
    get: (target, key) => {
      const pair = (target as unknown as Record<string | symbol, [string, string] | undefined>)[key];
      return Array.isArray(pair) ? tr(pair[0], pair[1]) : pair;
    },
    getOwnPropertyDescriptor: (target, key) => {
      const d = Reflect.getOwnPropertyDescriptor(target, key);
      const pair = d?.value as [string, string] | undefined;
      return d && Array.isArray(pair) ? { ...d, value: tr(pair[0], pair[1]) } : d;
    },
  });
}

export const ACCOUNT_TYPES = labels({
  checking: ["Conta corrente", "Checking"],
  savings: ["Poupança", "Savings"],
  cash: ["Dinheiro", "Cash"],
  credit_card: ["Cartão de crédito", "Credit card"],
  investment: ["Investimento", "Investment"],
  other: ["Outra", "Other"],
});

export const PAYMENT_METHODS = labels({
  pix: ["Pix", "Pix"],
  debit: ["Débito", "Debit"],
  credit: ["Crédito", "Credit"],
  cash: ["Dinheiro", "Cash"],
  boleto: ["Boleto", "Bank slip"],
  transfer: ["Transferência", "Transfer"],
  other: ["Outro", "Other"],
});

export const TX_TYPES = labels({
  income: ["Receita", "Income"],
  expense: ["Despesa", "Expense"],
  transfer: ["Transferência", "Transfer"],
  invest: ["Aplicação", "Deposit"],
  redeem: ["Resgate", "Withdrawal"],
});

/** Aplicações e resgates vêm dos investimentos (não são editados na tela de lançamentos). */
export const isInvestmentTx = (type: string) => type === "invest" || type === "redeem";

export const FREQUENCIES = labels({
  weekly: ["Semanal", "Weekly"],
  monthly: ["Mensal", "Monthly"],
  yearly: ["Anual", "Yearly"],
});

export const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#64748b", "#78716c",
];

export const INVESTMENT_TYPES = labels({
  caixinha: ["Caixinha", "Savings box"],
  cdb: ["CDB", "CDB"],
  tesouro: ["Tesouro Direto", "Treasury bonds"],
  lci_lca: ["LCI / LCA", "LCI / LCA"],
  poupanca: ["Poupança", "Savings account"],
  previdencia: ["Previdência", "Pension plan"],
  acoes: ["Ações", "Stocks"],
  fii: ["Fundos imobiliários", "Real estate funds"],
  cripto: ["Cripto", "Crypto"],
  outro: ["Outro", "Other"],
});

export const RATE_TYPES = labels({
  cdi: ["% do CDI", "% of CDI"],
  prefixed: ["Prefixado (% a.a.)", "Fixed (% p.a.)"],
  ipca: ["IPCA + % a.a.", "IPCA + % p.a."],
  poupanca: ["Regra da poupança", "Savings rule"],
  variable: ["Renda variável (sem taxa)", "Variable income (no rate)"],
});

/** Ex.: "115% do CDI", "IPCA + 6,2%", "12,5% a.a.". */
export function rateLabel(rateType: string, rate: number | null) {
  const n = (v: number | null) => (v ?? 0).toLocaleString(intlLocale(), { maximumFractionDigits: 2 });
  switch (rateType) {
    case "cdi": return tr(`${n(rate)}% do CDI`, `${n(rate)}% of CDI`);
    case "prefixed": return tr(`${n(rate)}% a.a.`, `${n(rate)}% p.a.`);
    case "ipca": return `IPCA + ${n(rate)}%`;
    case "poupanca": return tr("Poupança", "Savings");
    default: return tr("Renda variável", "Variable income");
  }
}
