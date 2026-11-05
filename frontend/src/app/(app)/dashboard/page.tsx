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
import { Card, Carousel, cuteHover, Dot, EmptyState, MonthPicker, PageHeader, Progress, Skeleton } from "@/components/ui";
import { CoupleGreeting } from "@/components/couple-greeting";
import { burstFrom } from "@/components/cute";
import { StatusBadge } from "@/components/status-badge";
import { CategoryBars, DailyChart, EvolutionChart, InvestmentEvolutionChart } from "@/components/charts";
import { CategoryIcon } from "@/components/icons";
import { useTxForm } from "@/components/app-shell";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/i18n";

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
    toast.success(t.type === "income" ? tr(`"${t.description}" marcado como recebido`, `"${t.description}" marked as received`) : tr(`"${t.description}" marcado como pago`, `"${t.description}" marked as paid`));
    invalidate();
  };

  const s = data?.summary;

  return (
    <>
      <PageHeader title="Dashboard" description={tr(`Visão geral de ${monthLabel(month).toLowerCase()}`, `Overview for ${monthLabel(month)}`)} actions={<MonthPicker value={month} onChange={setMonth} />} />
      <CoupleGreeting />

      {s && s.overdue_count > 0 && (
        <TxLink filters={{ status: "overdue" }} className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{tr("Você tem ", "You have ")}<strong>{tr(`${s.overdue_count} conta(s) vencida(s)`, `${s.overdue_count} overdue bill(s)`)}</strong>{tr(" somando ", " totaling ")}<strong>{money(s.overdue_amount)}</strong>{tr(". Clique para ver.", ". Click to see them.")}</span>
        </TxLink>
      )}

      <Carousel className="sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !s ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />) : (
          <>
            <StatCard icon={Landmark} tone="brand" label={tr("Saldo em contas", "Account balance")} value={money(s.total_balance)} sub={tr(`Previsto: ${money(s.projected_balance)}`, `Projected: ${money(s.projected_balance)}`)} />
            <StatCard icon={TrendingUp} tone="income" label={tr("Receitas do mês", "Income this month")} value={money(s.income)} variation={s.income_variation} sub={tr(`Recebido: ${money(s.income_paid)}`, `Received: ${money(s.income_paid)}`)} />
            <StatCard icon={TrendingDown} tone="expense" label={tr("Despesas do mês", "Expenses this month")} value={money(s.expense)} variation={s.expense_variation} invert sub={tr(`A pagar: ${money(s.expense_pending)}`, `To pay: ${money(s.expense_pending)}`)} />
            <StatCard icon={Scale} tone={s.balance >= 0 ? "income" : "expense"} label={tr("Resultado do mês", "Month result")} value={money(s.balance)} sub={s.savings_rate !== null ? tr(`Taxa de economia: ${percent(s.savings_rate)}`, `Savings rate: ${percent(s.savings_rate)}`) : tr("Sem receitas no mês", "No income this month")} />
          </>
        )}
      </Carousel>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title={tr("Receitas x despesas (12 meses)", "Income vs expenses (12 months)")} className="xl:col-span-2">
          {data ? <EvolutionChart data={data.evolution} /> : <Skeleton className="h-72" />}
        </Card>
        <Card title={tr("Despesas por categoria", "Expenses by category")} action={<Link href="/relatorios" className="text-xs text-brand-600 hover:underline">{tr("Relatórios", "Reports")}</Link>}>
          {data?.expenses_by_category.length ? (
            <CategoryBars data={data.expenses_by_category} limit={6} onSelect={(c) => { setTxIntent({ month, category_ids: [c.category_id!] }); router.push("/transacoes"); }} />
          ) : data ? <EmptyState title={tr("Sem despesas neste mês", "No expenses this month")} /> : <Skeleton className="h-64" />}
        </Card>
      </div>

      {data && <InvestmentsCard inv={data.investments} accountsTotal={data.summary.total_balance} />}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title={tr("Contas a pagar e receber", "Bills to pay and receive")} className="xl:col-span-2" padded={false}
          action={<TxLink filters={{ status: "unpaid" }} className="text-xs text-brand-600 hover:underline">{tr("Ver todas", "See all")}</TxLink>}>
          {data?.upcoming.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.upcoming.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <CategoryIcon icon={t.category?.icon} color={t.category?.color} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(t)}>
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.description}</p>
                    <p className="text-xs text-slate-500">{t.account?.name} · {fmtDate(t.date)}</p>
                  </button>
                  <StatusBadge t={t} />
                  <span className={cn("tabular shrink-0 text-right text-sm font-semibold sm:w-28", t.type === "income" ? "text-teal-600 dark:text-teal-400" : "text-slate-900 dark:text-white")}>
                    {money(t.type === "expense" || t.type === "invest" ? -t.amount : t.amount)}
                  </span>
                  <button onClick={(e) => pay(t, e)} title={tr("Marcar como pago", "Mark as paid")} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-500/10">
                    <Check className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={<CalendarClock className="h-6 w-6" />} title={tr("Nada pendente nos próximos 15 dias", "Nothing pending in the next 15 days")} description={tr("Contas vencidas e próximas aparecem aqui.", "Overdue and upcoming bills show up here.")} />}
        </Card>

        <Card title={tr("Saldo por conta", "Balance by account")} padded={false} action={<Link href="/contas" className="text-xs text-brand-600 hover:underline">{tr("Gerenciar", "Manage")}</Link>}>
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
        <Card title={tr("Fluxo acumulado do mês", "Month cash flow")} className="xl:col-span-2">
          {data ? <DailyChart data={data.daily} /> : <Skeleton className="h-56" />}
        </Card>
        <Card title={tr("Orçamentos", "Budgets")} action={<Link href="/orcamentos" className="text-xs text-brand-600 hover:underline">Ver todos</Link>}>
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
          ) : <EmptyState title={tr("Nenhum orçamento neste mês", "No budgets this month")} action={<Link href="/orcamentos" className="text-sm text-brand-600 hover:underline">{tr("Criar orçamento", "Create budget")}</Link>} />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title={tr("Últimos lançamentos", "Latest transactions")} className="xl:col-span-2" padded={false}
          action={<button onClick={() => openNew()} className="text-xs text-brand-600 hover:underline">{tr("+ Adicionar", "+ Add")}</button>}>
          {data?.recent.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recent.map((t) => (
                <li key={t.id}>
                  <button onClick={() => openEdit(t)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <CategoryIcon icon={t.investment ? "trending-up" : t.category?.icon ?? (t.type === "transfer" ? "repeat" : "tag")} color={t.investment?.color ?? t.category?.color} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-800 dark:text-slate-100">{t.description}</span>
                      <span className="text-xs text-slate-500">{fmtDate(t.date)} · {t.investment ? `${t.type === "invest" ? tr("Aplicação em", "Deposit to") : tr("Resgate de", "Withdrawal from")} ${t.investment.name}` : t.category?.name ?? (t.type === "transfer" ? tr("Transferência", "Transfer") : tr("Sem categoria", "No category"))}</span>
                    </span>
                    <span className={cn("tabular text-sm font-medium", t.type === "income" ? "text-teal-600 dark:text-teal-400" : t.type === "expense" ? "text-slate-900 dark:text-white" : "text-slate-500")}>
                      {money(t.type === "expense" || t.type === "invest" ? -t.amount : t.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState title={tr("Nenhum lançamento ainda", "No transactions yet")} action={<button onClick={() => openNew()} className="text-sm text-brand-600 hover:underline">{tr("Adicionar o primeiro", "Add the first one")}</button>} />}
        </Card>

        <Card title={tr("Metas", "Goals")} action={<Link href="/metas" className="text-xs text-brand-600 hover:underline">{tr("Ver todas", "See all")}</Link>}>
          {data?.goals.length ? (
            <ul className="space-y-4">
              {data.goals.map((g) => (
                <li key={g.id}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Target className="h-4 w-4" style={{ color: g.color }} />{g.name}</span>
                    <span className="text-xs font-medium text-slate-500">{percent(g.progress, 0)}</span>
                  </div>
                  <Progress value={g.progress} color={g.color} heart />
                  <p className="mt-1 text-xs text-slate-500">{money(g.current_amount)} {tr("de", "of")} {money(g.target_amount)}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState title={tr("Nenhuma meta ativa", "No active goals")} action={<Link href="/metas" className="text-sm text-brand-600 hover:underline">{tr("Criar meta", "Create goal")}</Link>} />}
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
          <ChartLine className="h-5 w-5 text-violet-500" /> {tr("Investimentos", "Investments")}
        </h2>
        <Link href="/investimentos" className="text-sm text-brand-600 hover:underline">{tr("Ver detalhes", "See details")}</Link>
      </div>

      <Carousel className="sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Landmark} tone="invest" label={tr("Total investido hoje", "Total invested today")} value={money(s.balance)}
          sub={tr(`Vocês colocaram ${money(s.invested)}`, `You put in ${money(s.invested)}`)} />
        <StatCard icon={TrendingUp} tone={s.yield >= 0 ? "income" : "expense"} label={tr("Rendimento total", "Total yield")} value={money(s.yield, { sign: true })}
          valueClass={pos(s.yield)} sub={s.yield_percent !== null ? tr(`${percent(s.yield_percent, 2)} sobre o investido`, `${percent(s.yield_percent, 2)} on the amount invested`) : undefined} />
        <StatCard icon={Sparkles} tone={s.month_yield >= 0 ? "income" : "expense"} label={tr("Rendeu este mês", "Earned this month")} value={money(s.month_yield, { sign: true })}
          valueClass={pos(s.month_yield)} sub={s.daily_yield > 0 ? tr(`~${money(s.daily_yield)} por dia útil · próx. 30 dias ~${money(s.projected_month_yield)}`, `~${money(s.daily_yield)} per business day · next 30 days ~${money(s.projected_month_yield)}`) : undefined} />
        <StatCard icon={PiggyBank} tone="brand" label={tr("Patrimônio total", "Net worth")} value={money(patrimony)}
          sub={tr(`${percent(patrimony > 0 ? (s.balance / patrimony) * 100 : 0, 0)} investido · contas ${money(accountsTotal)}`, `${percent(patrimony > 0 ? (s.balance / patrimony) * 100 : 0, 0)} invested · accounts ${money(accountsTotal)}`)} />
      </Carousel>

      {/* Sem investimentos ainda: os quadrinhos ficam zerados e aparece o convite. */}
      {!s.count ? (
        <Link href="/investimentos" className={cn("mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 px-5 py-4 text-sm text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/5 dark:text-violet-300", cuteHover)}>
          <ChartLine className="h-5 w-5 shrink-0" />
          <span>{tr("Têm caixinhas no Nubank ou outros investimentos? ", "Have savings boxes at Nubank or other investments? ")}<strong>{tr("Cadastre aqui", "Add them here")}</strong>{tr(" e os quadrinhos acima passam a mostrar quanto está rendendo.", " and the cards above will show how much they're earning.")}</span>
        </Link>
      ) : (
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title={tr("Evolução dos investimentos (12 meses)", "Investment growth (12 months)")} className="xl:col-span-2">
          <InvestmentEvolutionChart data={inv.evolution} height={240} />
        </Card>
        <Card title={tr("Seus investimentos", "Your investments")} padded={false}
          action={<span className="tabular text-xs text-slate-500">{tr(`${s.count} ativo${s.count > 1 ? "s" : ""}`, `${s.count} active`)}</span>}>
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
                  <span className={cn("tabular block text-xs", pos(i.month_yield))}>{money(i.month_yield, { sign: true })} {tr("no mês", "this month")}</span>
                </span>
              </li>
            ))}
          </ul>
          {s.count > inv.items.length && (
            <Link href="/investimentos" className="block border-t border-slate-100 py-2.5 text-center text-sm text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
              {tr(`Ver todos os ${s.count}`, `See all ${s.count}`)}
            </Link>
          )}
        </Card>
      </div>
      )}
    </section>
  );
}
