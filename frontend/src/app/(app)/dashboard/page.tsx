"use client";

import { setTxIntent } from "@/lib/navigation";
import { TxLink } from "@/components/filter-link";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, ChartLine, Check, Landmark, PiggyBank, Scale, Sparkles, Target, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { cn, currentMonth, fmtDate, money, monthLabel, percent, rateLabel } from "@/lib/format";
import { useInvalidateFinance } from "@/lib/queries";
import type { Budget, CategorySlice, EvolutionPoint, Goal, Investment, InvestmentSummary, Transaction } from "@/lib/types";
import { Card, cuteHover, Dot, EmptyState, MonthPicker, PageHeader, Progress, Skeleton } from "@/components/ui";
import { CoupleGreeting } from "@/components/couple-greeting";
import { burstFrom } from "@/components/cute";
import { StatusBadge } from "@/components/status-badge";
import { CategoryBars, DailyChart, EvolutionChart, InvestmentEvolutionChart } from "@/components/charts";
import { CategoryIcon } from "@/components/icons";
import { useTxForm } from "@/components/app-shell";
import { useRouter } from "next/navigation";

interface Summary {
  income: number; expense: number; balance: number; income_paid: number; expense_paid: number;
  income_pending: number; expense_pending: number; income_variation: number | null; expense_variation: number | null;
  savings_rate: number | null; total_balance: number; projected_balance: number; overdue_count: number; overdue_amount: number;
}
interface DashboardData {
  month: string;
  summary: Summary;
  accounts: { id: number; name: string; type: string; color: string; balance: number; projected_balance: number; credit_limit: number | null }[];
  expenses_by_category: CategorySlice[];
  income_by_category: CategorySlice[];
  evolution: EvolutionPoint[];
  daily: { date: string; income: number; expense: number; accumulated: number }[];
  upcoming: Transaction[];
  recent: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  investments: {
    summary: InvestmentSummary;
    items: Pick<Investment, "id" | "name" | "institution" | "color" | "balance" | "yield" | "yield_percent" | "month_yield" | "rate_type" | "rate" | "is_estimated">[];
    evolution: { month: string; balance: number; invested: number; yield: number }[];
  };
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const router = useRouter();
  const { openNew, openEdit } = useTxForm();
  const invalidate = useInvalidateFinance();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", month],
    queryFn: async () => (await api.get<DashboardData>("/dashboard", { params: { month } })).data,
    placeholderData: (prev) => prev,
  });

  const pay = async (t: Transaction, e: React.MouseEvent) => {
    burstFrom(e);
    await api.patch(`/transactions/${t.id}/pay`, { is_paid: true });
    toast.success(`"${t.description}" marcado como ${t.type === "income" ? "recebido" : "pago"}`);
    invalidate();
  };

  const s = data?.summary;

  return (
    <>
      <PageHeader title="Dashboard" description={`Visão geral de ${monthLabel(month).toLowerCase()}`} actions={<MonthPicker value={month} onChange={setMonth} />} />
      <CoupleGreeting />

      {s && s.overdue_count > 0 && (
        <TxLink filters={{ status: "overdue" }} className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Você tem <strong>{s.overdue_count} conta(s) vencida(s)</strong> somando <strong>{money(s.overdue_amount)}</strong>. Clique para ver.</span>
        </TxLink>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !s ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />) : (
          <>
            <StatCard icon={Landmark} tone="brand" label="Saldo em contas" value={money(s.total_balance)} sub={`Previsto: ${money(s.projected_balance)}`} />
            <StatCard icon={TrendingUp} tone="income" label="Receitas do mês" value={money(s.income)} variation={s.income_variation} sub={`Recebido: ${money(s.income_paid)}`} />
            <StatCard icon={TrendingDown} tone="expense" label="Despesas do mês" value={money(s.expense)} variation={s.expense_variation} invert sub={`A pagar: ${money(s.expense_pending)}`} />
            <StatCard icon={Scale} tone={s.balance >= 0 ? "income" : "expense"} label="Resultado do mês" value={money(s.balance)} sub={s.savings_rate !== null ? `Taxa de economia: ${percent(s.savings_rate)}` : "Sem receitas no mês"} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Receitas x despesas (12 meses)" className="xl:col-span-2">
          {data ? <EvolutionChart data={data.evolution} /> : <Skeleton className="h-72" />}
        </Card>
        <Card title="Despesas por categoria" action={<Link href="/relatorios" className="text-xs text-brand-600 hover:underline">Relatórios</Link>}>
          {data?.expenses_by_category.length ? (
            <CategoryBars data={data.expenses_by_category} limit={6} onSelect={(c) => { setTxIntent({ month, category_ids: [c.category_id!] }); router.push("/transacoes"); }} />
          ) : data ? <EmptyState title="Sem despesas neste mês" /> : <Skeleton className="h-64" />}
        </Card>
      </div>

      {data && <InvestmentsCard inv={data.investments} accountsTotal={data.summary.total_balance} />}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Contas a pagar e receber" className="xl:col-span-2" padded={false}
          action={<TxLink filters={{ status: "unpaid" }} className="text-xs text-brand-600 hover:underline">Ver todas</TxLink>}>
          {data?.upcoming.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.upcoming.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <CategoryIcon icon={t.category?.icon} color={t.category?.color} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(t)}>
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.description}</p>
                    <p className="text-xs text-slate-500">{t.account?.name} · {fmtDate(t.date)}</p>
                  </button>
                  <StatusBadge t={t} />
                  <span className={cn("tabular w-28 text-right text-sm font-semibold", t.type === "income" ? "text-teal-600 dark:text-teal-400" : "text-slate-900 dark:text-white")}>
                    {money(t.type === "expense" || t.type === "invest" ? -t.amount : t.amount)}
                  </span>
                  <button onClick={(e) => pay(t, e)} title="Marcar como pago" className="rounded-lg p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-500/10">
                    <Check className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nada pendente nos próximos 15 dias" description="Contas vencidas e próximas aparecem aqui." />}
        </Card>

        <Card title="Saldo por conta" padded={false} action={<Link href="/contas" className="text-xs text-brand-600 hover:underline">Gerenciar</Link>}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data?.accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200"><Dot color={a.color} /><span className="truncate">{a.name}</span></span>
                <span className={cn("tabular font-medium", a.balance < 0 ? "text-rose-600" : "text-slate-900 dark:text-white")}>{money(a.balance)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Fluxo acumulado do mês" className="xl:col-span-2">
          {data ? <DailyChart data={data.daily} /> : <Skeleton className="h-56" />}
        </Card>
        <Card title="Orçamentos" action={<Link href="/orcamentos" className="text-xs text-brand-600 hover:underline">Ver todos</Link>}>
          {data?.budgets.length ? (
            <ul className="space-y-4">
              {data.budgets.map((b) => (
                <li key={b.id}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Dot color={b.category.color} />{b.category.name}</span>
                    <span className="tabular text-xs text-slate-500">{money(b.spent)} / {money(b.amount)}</span>
                  </div>
                  <Progress value={b.percent} />
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Nenhum orçamento neste mês" action={<Link href="/orcamentos" className="text-sm text-brand-600 hover:underline">Criar orçamento</Link>} />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Últimos lançamentos" className="xl:col-span-2" padded={false}
          action={<button onClick={() => openNew()} className="text-xs text-brand-600 hover:underline">+ Adicionar</button>}>
          {data?.recent.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recent.map((t) => (
                <li key={t.id}>
                  <button onClick={() => openEdit(t)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <CategoryIcon icon={t.investment ? "trending-up" : t.category?.icon ?? (t.type === "transfer" ? "repeat" : "tag")} color={t.investment?.color ?? t.category?.color} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-800 dark:text-slate-100">{t.description}</span>
                      <span className="text-xs text-slate-500">{fmtDate(t.date)} · {t.investment ? `${t.type === "invest" ? "Aplicação em" : "Resgate de"} ${t.investment.name}` : t.category?.name ?? (t.type === "transfer" ? "Transferência" : "Sem categoria")}</span>
                    </span>
                    <span className={cn("tabular text-sm font-medium", t.type === "income" ? "text-teal-600 dark:text-teal-400" : t.type === "expense" ? "text-slate-900 dark:text-white" : "text-slate-500")}>
                      {money(t.type === "expense" || t.type === "invest" ? -t.amount : t.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Nenhum lançamento ainda" action={<button onClick={() => openNew()} className="text-sm text-brand-600 hover:underline">Adicionar o primeiro</button>} />}
        </Card>

        <Card title="Metas" action={<Link href="/metas" className="text-xs text-brand-600 hover:underline">Ver todas</Link>}>
          {data?.goals.length ? (
            <ul className="space-y-4">
              {data.goals.map((g) => (
                <li key={g.id}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Target className="h-4 w-4" style={{ color: g.color }} />{g.name}</span>
                    <span className="text-xs font-medium text-slate-500">{percent(g.progress, 0)}</span>
                  </div>
                  <Progress value={g.progress} color={g.color} heart />
                  <p className="mt-1 text-xs text-slate-500">{money(g.current_amount)} de {money(g.target_amount)}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Nenhuma meta ativa" action={<Link href="/metas" className="text-sm text-brand-600 hover:underline">Criar meta</Link>} />}
        </Card>
      </div>
    </>
  );
}

const tones = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  income: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
  expense: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  invest: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
};

function StatCard({ icon: Icon, label, value, sub, tone, variation, invert, valueClass }: {
  icon: LucideIcon; label: string; value: string; sub?: string; tone: keyof typeof tones; variation?: number | null; invert?: boolean; valueClass?: string;
}) {
  const good = variation !== null && variation !== undefined && (invert ? variation <= 0 : variation >= 0);
  return (
    <div className={cn("group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", cuteHover)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
        <span className={cn("rounded-lg p-2", tones[tone])}><Icon className="h-4 w-4 cute:group-hover:animate-wiggle" /></span>
      </div>
      <p className={cn("tabular mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white", valueClass)}>{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        {variation !== null && variation !== undefined && (
          <span className={cn("inline-flex items-center font-medium", good ? "text-teal-600" : "text-rose-600")}>
            {variation >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {percent(Math.abs(variation), 0)}
          </span>
        )}
        <span className="truncate">{sub}</span>
      </div>
    </div>
  );
}

/** Patrimônio do casal: contas + investimentos, com o rendimento. */
function InvestmentsCard({ inv, accountsTotal }: { inv: DashboardData["investments"]; accountsTotal: number }) {
  const s = inv.summary;
  const pos = (v: number) => (v >= 0 ? "text-teal-600 dark:text-teal-400" : "text-rose-600");
  const patrimony = accountsTotal + s.balance;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <ChartLine className="h-5 w-5 text-violet-500" /> Investimentos
        </h2>
        <Link href="/investimentos" className="text-sm text-brand-600 hover:underline">Ver detalhes</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Landmark} tone="invest" label="Total investido hoje" value={money(s.balance)}
          sub={`Vocês colocaram ${money(s.invested)}`} />
        <StatCard icon={TrendingUp} tone={s.yield >= 0 ? "income" : "expense"} label="Rendimento total" value={money(s.yield, { sign: true })}
          valueClass={pos(s.yield)} sub={s.yield_percent !== null ? `${percent(s.yield_percent, 2)} sobre o investido` : undefined} />
        <StatCard icon={Sparkles} tone={s.month_yield >= 0 ? "income" : "expense"} label="Rendeu este mês" value={money(s.month_yield, { sign: true })}
          valueClass={pos(s.month_yield)} sub={s.daily_yield > 0 ? `~${money(s.daily_yield)} por dia útil · próx. 30 dias ~${money(s.projected_month_yield)}` : undefined} />
        <StatCard icon={PiggyBank} tone="brand" label="Patrimônio total" value={money(patrimony)}
          sub={`${percent(patrimony > 0 ? (s.balance / patrimony) * 100 : 0, 0)} investido · contas ${money(accountsTotal)}`} />
      </div>

      {/* Sem investimentos ainda: os quadrinhos ficam zerados e aparece o convite. */}
      {!s.count ? (
        <Link href="/investimentos" className={cn("mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 px-5 py-4 text-sm text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/5 dark:text-violet-300", cuteHover)}>
          <ChartLine className="h-5 w-5 shrink-0" />
          <span>Têm caixinhas no Nubank ou outros investimentos? <strong>Cadastre aqui</strong> e os quadrinhos acima passam a mostrar quanto está rendendo.</span>
        </Link>
      ) : (
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Evolução dos investimentos (12 meses)" className="xl:col-span-2">
          <InvestmentEvolutionChart data={inv.evolution} height={240} />
        </Card>
        <Card title="Seus investimentos" padded={false}
          action={<span className="tabular text-xs text-slate-500">{s.count} ativo{s.count > 1 ? "s" : ""}</span>}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {inv.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Dot color={i.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{i.name}</span>
                  <span className="text-xs text-slate-500">{[i.institution, rateLabel(i.rate_type, i.rate)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="text-right">
                  <span className="tabular block font-semibold text-slate-900 dark:text-white">{money(i.balance)}</span>
                  <span className={cn("tabular block text-xs", pos(i.month_yield))}>{money(i.month_yield, { sign: true })} no mês</span>
                </span>
              </li>
            ))}
          </ul>
          {s.count > inv.items.length && (
            <Link href="/investimentos" className="block border-t border-slate-100 py-2.5 text-center text-sm text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
              Ver todos os {s.count}
            </Link>
          )}
        </Card>
      </div>
      )}
    </section>
  );
}
