"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, startOfYear, subMonths, endOfMonth } from "date-fns";
import { api } from "@/lib/api";
import { cn, fmtDate, money, monthLabel, PAYMENT_METHODS, percent } from "@/lib/format";
import { useAccounts } from "@/lib/queries";
import type { CategorySlice, EvolutionPoint, Transaction } from "@/lib/types";
import { Card, Carousel, DatePicker, Dot, EmptyState, MultiSelect, PageHeader, Skeleton } from "@/components/ui";
import { BalanceChart, CategoryBars, EvolutionChart } from "@/components/charts";

interface Group { label: string; total: number; count: number; percent?: number; color?: string }
interface Report {
  period: { from: string; to: string; days: number };
  summary: { income: number; expense: number; balance: number; avg_daily_expense: number; avg_monthly_expense: number; avg_monthly_income: number; savings_rate: number | null; transactions: number };
  expenses_by_category: CategorySlice[];
  income_by_category: CategorySlice[];
  evolution: EvolutionPoint[];
  by_account: Group[];
  by_payment_method: Group[];
  by_tag: Group[];
  top_expenses: Transaction[];
}

const d = (x: Date) => format(x, "yyyy-MM-dd");
const presets = [
  { label: "Este mês", from: () => d(startOfMonth(new Date())), to: () => d(endOfMonth(new Date())) },
  { label: "Últimos 3 meses", from: () => d(startOfMonth(subMonths(new Date(), 2))), to: () => d(endOfMonth(new Date())) },
  { label: "Últimos 6 meses", from: () => d(startOfMonth(subMonths(new Date(), 5))), to: () => d(endOfMonth(new Date())) },
  { label: "Este ano", from: () => d(startOfYear(new Date())), to: () => d(endOfMonth(new Date())) },
  { label: "Últimos 12 meses", from: () => d(startOfMonth(subMonths(new Date(), 11))), to: () => d(endOfMonth(new Date())) },
];

export default function ReportsPage() {
  const [from, setFrom] = useState(presets[2].from());
  const [to, setTo] = useState(presets[2].to());
  const [accountIds, setAccountIds] = useState<number[]>([]);
  const { data: accountsData } = useAccounts();

  const { data, isLoading } = useQuery({
    queryKey: ["reports", from, to, accountIds],
    queryFn: async () => (await api.get<Report>("/reports", { params: { from, to, account_ids: accountIds.length ? accountIds : undefined } })).data,
    placeholderData: (p) => p,
  });

  const s = data?.summary;

  return (
    <>
      <PageHeader title="Relatórios" description="Analise seus gastos e receitas em qualquer período" />

      <Card className="mb-6" padded={false}>
        <div className="flex flex-wrap items-center gap-2 p-3">
          {presets.map((p) => {
            const active = p.from() === from && p.to() === to;
            return (
              <button key={p.label} onClick={() => { setFrom(p.from()); setTo(p.to()); }}
                className={cn("h-9 rounded-lg px-3 text-sm font-medium", active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200")}>
                {p.label}
              </button>
            );
          })}
          <div className="flex items-center gap-2">
            <DatePicker value={from} onChange={(v) => setFrom(v)} className="h-9 w-44" />
            <span className="text-slate-400">até</span>
            <DatePicker value={to} onChange={(v) => setTo(v)} className="h-9 w-44" />
          </div>
          <div className="w-48"><MultiSelect label="Todas as contas" options={accountsData?.data ?? []} value={accountIds} onChange={setAccountIds} /></div>
        </div>
      </Card>

      {isLoading || !s ? <Skeleton className="h-96" /> : (
        <>
          <Carousel className="sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Receitas" value={money(s.income)} sub={`Média ${money(s.avg_monthly_income)}/mês`} tone="text-teal-600 dark:text-teal-400" />
            <Kpi label="Despesas" value={money(s.expense)} sub={`Média ${money(s.avg_monthly_expense)}/mês · ${money(s.avg_daily_expense)}/dia`} tone="text-rose-600 dark:text-rose-400" />
            <Kpi label="Resultado" value={money(s.balance)} sub={`${s.transactions} lançamentos`} tone={s.balance < 0 ? "text-rose-600" : undefined} />
            <Kpi label="Taxa de economia" value={percent(s.savings_rate)} sub="Quanto da receita sobrou" />
          </Carousel>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Receitas x despesas por mês"><EvolutionChart data={data.evolution} height={260} /></Card>
            <Card title="Resultado mensal (receitas − despesas)"><BalanceChart data={data.evolution} height={284} /></Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Despesas por categoria">{data.expenses_by_category.length ? <CategoryBars data={data.expenses_by_category} limit={10} /> : <EmptyState title="Sem despesas no período" />}</Card>
            <Card title="Receitas por categoria">{data.income_by_category.length ? <CategoryBars data={data.income_by_category} limit={10} /> : <EmptyState title="Sem receitas no período" />}</Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <GroupTable title="Despesas por conta" rows={data.by_account} />
            <GroupTable title="Por forma de pagamento" rows={data.by_payment_method.map((r) => ({ ...r, label: PAYMENT_METHODS[r.label] ?? r.label }))} />
            <GroupTable title="Despesas por tag" rows={data.by_tag} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Maiores despesas do período" padded={false}>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.top_expenses.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                    <Dot color={t.category?.color} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-slate-800 dark:text-slate-100">{t.description}</span><span className="text-xs text-slate-500">{fmtDate(t.date)} · {t.category?.name ?? "Sem categoria"}</span></span>
                    <span className="tabular font-medium text-slate-900 dark:text-white">{money(t.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Tabela mensal" padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase dark:bg-slate-800/50">
                    <tr><th className="px-5 py-2.5 text-left">Mês</th><th className="px-3 py-2.5 text-right">Receitas</th><th className="px-3 py-2.5 text-right">Despesas</th><th className="px-5 py-2.5 text-right">Resultado</th></tr>
                  </thead>
                  <tbody className="tabular divide-y divide-slate-100 dark:divide-slate-800">
                    {data.evolution.map((m) => (
                      <tr key={m.month}>
                        <td className="px-5 py-2 text-slate-700 dark:text-slate-300">{monthLabel(m.month)}</td>
                        <td className="px-3 py-2 text-right text-teal-600 dark:text-teal-400">{money(m.income)}</td>
                        <td className="px-3 py-2 text-right text-rose-600 dark:text-rose-400">{money(m.expense)}</td>
                        <td className={cn("px-5 py-2 text-right font-medium", m.balance < 0 ? "text-rose-600" : "text-slate-900 dark:text-white")}>{money(m.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn("tabular mt-1 text-2xl font-bold text-slate-900 dark:text-white", tone)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function GroupTable({ title, rows }: { title: string; rows: Group[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <Card title={title}>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label} className="text-sm">
              <div className="mb-1 flex justify-between gap-2">
                <span className="flex items-center gap-2 truncate text-slate-700 dark:text-slate-300">{r.color && <Dot color={r.color} />}{r.label}</span>
                <span className="tabular shrink-0 text-slate-900 dark:text-white">{money(r.total)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.total / max) * 100}%`, backgroundColor: r.color }} /></div>
            </li>
          ))}
        </ul>
      ) : <p className="py-6 text-center text-sm text-slate-400">Sem dados no período</p>}
    </Card>
  );
}
