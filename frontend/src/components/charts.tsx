"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDate, money, monthLabel, percent } from "@/lib/format";
import type { CategorySlice, EvolutionPoint } from "@/lib/types";
import { Dot } from "@/components/ui";

// Par validado (CVD deutan ΔE 10.2, contraste ≥ 3:1 em claro e escuro).
export const INCOME_COLOR = "#0d9488";
export const EXPENSE_COLOR = "#e11d48";
export const BALANCE_COLOR = "#7c3aed"; // lavanda: não se confunde com o rosa das despesas

interface TipRow { name?: string | number; value?: number | string; color?: string }

function ChartTooltip({ active, payload, label, labelFormat }: { active?: boolean; payload?: TipRow[]; label?: string; labelFormat: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1 font-medium text-slate-800 dark:text-slate-100">{labelFormat(String(label))}</p>
      {payload.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Dot color={p.color} className="h-2 w-2" />
          {p.name}: <span className="tabular font-medium text-slate-900 dark:text-white">{money(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5"><Dot color={i.color} className="h-2 w-2" />{i.label}</span>
      ))}
    </div>
  );
}

const axisMoney = (v: number) => money(v, { compact: true });

/** Receitas x despesas por mês (barras agrupadas, um único eixo). */
export function EvolutionChart({ data, height = 280 }: { data: EvolutionPoint[]; height?: number }) {
  return (
    <div>
      <Legend items={[{ label: "Receitas", color: INCOME_COLOR }, { label: "Despesas", color: EXPENSE_COLOR }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ left: 4, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, true)} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={axisMoney} tickLine={false} axisLine={false} width={64} />
          <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} content={<ChartTooltip labelFormat={(m) => monthLabel(m)} />} />
          <Bar dataKey="income" name="Receitas" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expense" name="Despesas" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Resultado (receitas − despesas) por mês. */
export function BalanceChart({ data, height = 220 }: { data: EvolutionPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, true)} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={axisMoney} tickLine={false} axisLine={false} width={64} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} content={<ChartTooltip labelFormat={(m) => monthLabel(m)} />} />
        <Bar dataKey="balance" name="Resultado" fill={BALANCE_COLOR} radius={[4, 4, 4, 4]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Saldo acumulado dia a dia no mês. */
export function DailyChart({ data, height = 220 }: { data: { date: string; accumulated: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
        <defs>
          <linearGradient id="accFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BALANCE_COLOR} stopOpacity={0.25} />
            <stop offset="100%" stopColor={BALANCE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, "dd")} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tickFormatter={axisMoney} tickLine={false} axisLine={false} width={64} />
        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
        <Tooltip cursor={{ stroke: "#94a3b8" }} content={<ChartTooltip labelFormat={(d) => fmtDate(d, "dd 'de' MMMM")} />} />
        <Area type="monotone" dataKey="accumulated" name="Acumulado no mês" stroke={BALANCE_COLOR} strokeWidth={2} fill="url(#accFill)" activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Ranking de categorias com barra proporcional (a cor é a da categoria, escolhida pelo usuário). */
export function CategoryBars({ data, limit = 8, onSelect }: { data: CategorySlice[]; limit?: number; onSelect?: (c: CategorySlice) => void }) {
  const top = data.slice(0, limit);
  const rest = data.slice(limit);
  const rows = rest.length
    ? [...top, { category_id: null, name: `Outras (${rest.length})`, color: "#94a3b8", total: rest.reduce((s, r) => s + r.total, 0), count: rest.reduce((s, r) => s + r.count, 0), percent: rest.reduce((s, r) => s + r.percent, 0) }]
    : top;
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={`${r.category_id}-${r.name}`}>
          <button type="button" disabled={!onSelect || r.category_id === null} onClick={() => onSelect?.(r)} className="group w-full text-left disabled:cursor-default" title={`${r.count} lançamento(s)`}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-slate-700 group-enabled:group-hover:underline dark:text-slate-200">
                <Dot color={r.color} /> <span className="truncate">{r.name}</span>
              </span>
              <span className="tabular shrink-0 text-slate-900 dark:text-white">
                {money(r.total)} <span className="ml-1 text-xs text-slate-500">{percent(r.percent, 0)}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full" style={{ width: `${(r.total / max) * 100}%`, backgroundColor: r.color }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ Investimentos ------------------------------ */

// Par validado (CVD deutan ΔE 15, contraste ≥ 3:1 em claro e escuro); "investido" também é tracejado.
export const INVEST_BALANCE_COLOR = "#7c3aed";
export const INVEST_INVESTED_COLOR = "#0891b2";

/** Saldo dos investimentos x quanto foi investido, mês a mês (um único eixo, em R$). */
export function InvestmentEvolutionChart({ data, height = 260 }: { data: { month: string; balance: number; invested: number }[]; height?: number }) {
  return (
    <div>
      <Legend items={[{ label: "Saldo", color: INVEST_BALANCE_COLOR }, { label: "Investido (aportes − resgates)", color: INVEST_INVESTED_COLOR }]} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
          <defs>
            <linearGradient id="invFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INVEST_BALANCE_COLOR} stopOpacity={0.22} />
              <stop offset="100%" stopColor={INVEST_BALANCE_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, true)} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={axisMoney} tickLine={false} axisLine={false} width={64} />
          <Tooltip cursor={{ stroke: "#94a3b8" }} content={<ChartTooltip labelFormat={(m) => monthLabel(m)} />} />
          <Area type="monotone" dataKey="invested" name="Investido" stroke={INVEST_INVESTED_COLOR} strokeWidth={2} strokeDasharray="5 4" fill="none" activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="balance" name="Saldo" stroke={INVEST_BALANCE_COLOR} strokeWidth={2} fill="url(#invFill)" activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Quanto rendeu em cada mês. */
export function MonthlyYieldChart({ data, height = 220 }: { data: { month: string; yield: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, true)} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={axisMoney} tickLine={false} axisLine={false} width={64} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} content={<ChartTooltip labelFormat={(m) => monthLabel(m)} />} />
        <Bar dataKey="yield" name="Rendimento" fill={INCOME_COLOR} radius={[4, 4, 4, 4]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
