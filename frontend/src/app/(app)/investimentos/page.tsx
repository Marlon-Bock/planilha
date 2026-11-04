"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownToLine, ArrowUpFromLine, CalendarClock, ChartLine, History, Info, Landmark, Pencil, Plus, RefreshCw, Sparkles, Trash2, TrendingUp,
} from "lucide-react";
import { api, parseError, type FieldErrors } from "@/lib/api";
import { cn, fmtDate, INVESTMENT_TYPES, money, parseAmount, percent, RATE_TYPES, rateLabel } from "@/lib/format";
import { useInvalidateFinance } from "@/lib/queries";
import type { Investment, InvestmentMovement, InvestmentSummary, MarketRates } from "@/lib/types";
import {
  Badge, Button, Card, ColorPicker, ConfirmDialog, cuteHover, DatePicker, EmptyState, Field, Input, Modal, MoneyInput, PageHeader, Pagination, Select, Skeleton, Textarea, Toggle,
} from "@/components/ui";
import { InvestmentEvolutionChart, MonthlyYieldChart } from "@/components/charts";

interface InvestmentsResponse {
  data: Investment[];
  summary: InvestmentSummary;
  evolution: { month: string; balance: number; invested: number; yield: number }[];
  rates: MarketRates;
}

import { MovementForm, type MovementKind } from "@/components/investment-movement-form";

export default function InvestmentsPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  // inv = null: o investimento é escolhido no próprio formulário ("Registrar aplicação").
  const [moving, setMoving] = useState<{ inv: Investment | null; kind: MovementKind } | null>(null);
  const [tab, setTab] = useState<"overview" | "statement">("overview");
  const [history, setHistory] = useState<Investment | null>(null);
  const [toDelete, setToDelete] = useState<Investment | null>(null);
  const invalidate = useInvalidateFinance();

  const { data, isLoading } = useQuery({
    queryKey: ["investments", { showInactive }],
    queryFn: async () => (await api.get<InvestmentsResponse>("/investments", { params: { with_inactive: showInactive ? 1 : 0 } })).data,
  });

  const remove = async () => {
    await api.delete(`/investments/${toDelete!.id}`);
    toast.success("Investimento excluído");
    setToDelete(null);
    invalidate();
  };

  const s = data?.summary;
  const list = data?.data ?? [];
  // Agrupa por instituição (Nubank, Inter...), maior saldo primeiro.
  const groups = Object.entries(
    list.reduce<Record<string, Investment[]>>((acc, inv) => {
      (acc[inv.institution || "Outros"] ??= []).push(inv);
      return acc;
    }, {}),
  ).sort((a, b) => b[1].reduce((t, i) => t + i.balance, 0) - a[1].reduce((t, i) => t + i.balance, 0));

  return (
    <>
      <PageHeader title="Investimentos" description="Caixinhas, CDBs, Tesouro e mais: quanto vocês investiram e quanto já rendeu"
        actions={<>
          <Toggle checked={showInactive} onChange={setShowInactive} label="Mostrar resgatados" />
          <Button variant="outline" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Novo investimento</Button>
          <Button disabled={!list.length} onClick={() => setMoving({ inv: null, kind: "deposit" })} title={list.length ? undefined : "Cadastre um investimento primeiro"}>
            <ArrowDownToLine className="h-4 w-4" /> Registrar aplicação
          </Button>
        </>} />

      {data && <RatesStrip rates={data.rates} />}

      {list.length > 0 && (
        <div className="mb-6 inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {([["overview", "Visão geral"], ["statement", "Extrato"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("rounded-lg px-4 py-1.5 text-sm font-medium transition", tab === k ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")}>
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "statement" && list.length > 0 && <Statement investments={list} />}

      {tab === "statement" && list.length > 0 ? null : isLoading || !s ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<ChartLine className="h-6 w-6" />} title="Nenhum investimento ainda"
            description="Cadastre as caixinhas do Nubank (ou outros investimentos) com quanto vocês colocaram e quanto tem hoje. O rendimento a gente calcula."
            action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Cadastrar o primeiro</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Landmark} label="Total investido hoje" value={money(s.balance)} sub={`Vocês colocaram ${money(s.invested)}`} />
            <Kpi icon={TrendingUp} label="Rendimento total" value={money(s.yield, { sign: true })} tone={s.yield >= 0 ? "pos" : "neg"}
              sub={s.yield_percent !== null ? `${percent(s.yield_percent, 2)} sobre o investido` : undefined} />
            <Kpi icon={Sparkles} label="Rendeu este mês" value={money(s.month_yield, { sign: true })} tone={s.month_yield >= 0 ? "pos" : "neg"}
              sub={s.projected_month_yield ? `Próximos 30 dias: ~${money(s.projected_month_yield)}` : undefined} />
            <Kpi icon={CalendarClock} label="Rende por dia útil" value={s.daily_yield ? `~${money(s.daily_yield)}` : "—"}
              sub={s.daily_yield ? "Estimativa com o CDI de hoje" : "Sem taxa para estimar"} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card title="Evolução do patrimônio investido" className="xl:col-span-2"><InvestmentEvolutionChart data={data.evolution} /></Card>
            <Card title="Rendimento por mês"><MonthlyYieldChart data={data.evolution} height={284} /></Card>
          </div>

          {groups.map(([institution, items]) => {
            const total = items.reduce((t, i) => t + i.balance, 0);
            const gained = items.reduce((t, i) => t + i.yield, 0);
            return (
              <section key={institution} className="mt-8">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                    <Landmark className="h-4.5 w-4.5 text-violet-500" /> {institution}
                    <span className="text-sm font-normal text-slate-500">· {items.length} investimento{items.length > 1 ? "s" : ""}</span>
                  </h2>
                  <p className="text-sm text-slate-500">
                    <span className="tabular font-semibold text-slate-900 dark:text-white">{money(total)}</span>
                    <span className={cn("tabular ml-2", gained >= 0 ? "text-teal-600 dark:text-teal-400" : "text-rose-600")}>{money(gained, { sign: true })} rendidos</span>
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((inv) => (
                    <InvestmentCard key={inv.id} inv={inv}
                      onMove={(kind) => setMoving({ inv, kind })}
                      onHistory={() => setHistory(inv)}
                      onEdit={() => { setEditing(inv); setFormOpen(true); }}
                      onDelete={() => setToDelete(inv)} />
                  ))}
                </div>
              </section>
            );
          })}

          <p className="mt-6 flex items-start gap-2 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Valores brutos (antes do IR). Entre uma atualização e outra, o saldo é estimado com o CDI do Banco Central e os dias úteis
            (sem considerar feriados). Use “Atualizar saldo” com o valor do app do banco para deixar tudo exato.
          </p>
        </>
      )}

      <InvestmentForm open={formOpen} onClose={() => setFormOpen(false)} investment={editing} />
      <MovementForm state={moving} investments={list} onClose={() => setMoving(null)} />
      <HistoryModal investment={history} onClose={() => setHistory(null)} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title="Excluir investimento" confirmLabel="Excluir"
        message={<>Excluir <strong>{toDelete?.name}</strong> e todo o histórico dele? Se vocês só resgataram tudo, prefira marcar como resgatado na edição.</>} />
    </>
  );
}

/* --------------------------------- Partes --------------------------------- */

function RatesStrip({ rates }: { rates: MarketRates }) {
  const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="font-medium text-slate-800 dark:text-slate-100">CDI hoje: {n(rates.cdi)}% a.a.</span>
      <span className="text-slate-500">Selic: {n(rates.selic)}%</span>
      <span className="text-slate-500">IPCA (12 meses): {n(rates.ipca)}%</span>
      <span className="ml-auto text-xs text-slate-400">
        {rates.source === "bcb" ? `Fonte: Banco Central${rates.date ? `, ${fmtDate(rates.date)}` : ""}` : "Banco Central indisponível: usando a última taxa conhecida"}
      </span>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Landmark; label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div className={cn("group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", cuteHover)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
        <span className="rounded-lg bg-violet-50 p-2 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"><Icon className="h-4 w-4 cute:group-hover:animate-wiggle" /></span>
      </div>
      <p className={cn("tabular mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white", tone === "pos" && "text-teal-600 dark:text-teal-400", tone === "neg" && "text-rose-600")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function InvestmentCard({ inv, onMove, onHistory, onEdit, onDelete }: {
  inv: Investment; onMove: (k: MovementKind) => void; onHistory: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const icon = "rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200";
  return (
    <div className={cn("group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", cuteHover, !inv.is_active && "opacity-60")}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: inv.color }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-white">{inv.name}</p>
          <p className="text-xs text-slate-500">{[inv.institution, INVESTMENT_TYPES[inv.type]].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex shrink-0 opacity-60 group-hover:opacity-100">
          <button className={icon} onClick={onHistory} title="Histórico" aria-label="Histórico"><History className="h-4 w-4" /></button>
          <button className={icon} onClick={onEdit} title="Editar" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
          <button className={cn(icon, "hover:text-rose-600")} onClick={onDelete} title="Excluir" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="violet">{rateLabel(inv.rate_type, inv.rate)}</Badge>
        {inv.annual_rate !== null && <Badge>≈ {percent(inv.annual_rate, 2)} a.a.</Badge>}
        {inv.goal && <Badge tone="green">🎯 Meta: {inv.goal.name}</Badge>}
        {inv.liquidity === "maturity" && <Badge tone="amber">Vence {inv.maturity_date ? fmtDate(inv.maturity_date) : "no prazo"}</Badge>}
        {!inv.is_active && <Badge>Resgatado</Badge>}
      </div>

      <p className="mt-4 text-xs text-slate-500">Saldo {inv.is_estimated ? "estimado hoje" : "atual"}</p>
      <p className="tabular text-2xl font-bold text-slate-900 dark:text-white">{money(inv.balance)}</p>
      {inv.last_reported_at && (
        <p className="text-xs text-slate-400">Último saldo do banco: {money(inv.last_reported_balance)} em {fmtDate(inv.last_reported_at)}</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Investido</dt>
          <dd className="tabular font-medium text-slate-800 dark:text-slate-100">{money(inv.invested)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Rendeu no total</dt>
          <dd className={cn("tabular font-semibold", inv.yield >= 0 ? "text-teal-600 dark:text-teal-400" : "text-rose-600")}>
            {money(inv.yield, { sign: true })} {inv.yield_percent !== null && <span className="text-xs font-normal">({percent(inv.yield_percent, 2)})</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Este mês</dt>
          <dd className={cn("tabular font-medium", inv.month_yield >= 0 ? "text-teal-600 dark:text-teal-400" : "text-rose-600")}>{money(inv.month_yield, { sign: true })}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Por dia útil</dt>
          <dd className="tabular font-medium text-slate-800 dark:text-slate-100">{inv.daily_yield !== null ? `~${money(inv.daily_yield)}` : "—"}</dd>
        </div>
      </dl>

      <div className="mt-auto flex gap-2 pt-5">
        <Button size="sm" className="flex-1" onClick={() => onMove("deposit")}><ArrowDownToLine className="h-4 w-4" /> Aplicar</Button>
        <Button size="sm" variant="outline" onClick={() => onMove("withdraw")} title="Resgatar"><ArrowUpFromLine className="h-4 w-4" /> Resgatar</Button>
        <Button size="sm" variant="outline" onClick={() => onMove("balance")} title="Atualizar com o saldo do app"><RefreshCw className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/* --------------------------------- Formulários --------------------------------- */

interface FormState {
  name: string; institution: string; type: string; rate_type: string; rate: string; liquidity: string; maturity_date: string;
  color: string; is_active: boolean; notes: string; invested_amount: string; current_balance: string; start_date: string; goal_id: string;
}

const PRESETS: { label: string; hint: string; v: Partial<FormState> }[] = [
  { label: "Caixinha Nubank", hint: "100% do CDI", v: { institution: "Nubank", type: "caixinha", rate_type: "cdi", rate: "100", liquidity: "daily", color: "#8b5cf6" } },
  { label: "Caixinha Turbo Nubank", hint: "115% do CDI", v: { institution: "Nubank", type: "caixinha", rate_type: "cdi", rate: "115", liquidity: "daily", color: "#a855f7" } },
  { label: "CDB liquidez diária", hint: "% do CDI", v: { type: "cdb", rate_type: "cdi", rate: "100", liquidity: "daily", color: "#3b82f6" } },
  { label: "Tesouro Selic", hint: "≈ 100% do CDI", v: { institution: "Tesouro Direto", type: "tesouro", rate_type: "cdi", rate: "100", liquidity: "daily", color: "#10b981" } },
  { label: "Tesouro IPCA+", hint: "IPCA + taxa", v: { institution: "Tesouro Direto", type: "tesouro", rate_type: "ipca", rate: "6", liquidity: "maturity", color: "#14b8a6" } },
  { label: "Poupança", hint: "0,5% ao mês", v: { type: "poupanca", rate_type: "poupanca", rate: "", liquidity: "daily", color: "#eab308" } },
  { label: "Ações / FII / Cripto", hint: "saldo informado", v: { type: "acoes", rate_type: "variable", rate: "", liquidity: "daily", color: "#f97316" } },
];

type InvestmentFormProps = { open: boolean; onClose: () => void; investment: Investment | null };

function InvestmentForm(props: InvestmentFormProps) {
  return props.open ? <InvestmentFormInner key={props.investment?.id ?? "new"} {...props} /> : null;
}

function InvestmentFormInner({ onClose, investment }: InvestmentFormProps) {
  const [form, setForm] = useState<FormState>(() => investment ? {
    name: investment.name, institution: investment.institution ?? "", type: investment.type, rate_type: investment.rate_type,
    rate: investment.rate !== null ? String(investment.rate).replace(".", ",") : "", liquidity: investment.liquidity,
    maturity_date: investment.maturity_date ?? "", color: investment.color, is_active: investment.is_active, notes: investment.notes ?? "", goal_id: investment.goal_id ? String(investment.goal_id) : "",
    invested_amount: "", current_balance: "", start_date: "",
  } : {
    name: "", institution: "Nubank", type: "caixinha", rate_type: "cdi", rate: "100", liquidity: "daily", maturity_date: "", color: "#8b5cf6",
    is_active: true, notes: "", invested_amount: "", current_balance: "", start_date: "", goal_id: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateFinance();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const needsRate = ["cdi", "prefixed", "ipca"].includes(form.rate_type);
  const invested = form.invested_amount ? parseAmount(form.invested_amount) : 0;
  const balance = form.current_balance ? parseAmount(form.current_balance) : 0;
  const { data: goals = [] } = useQuery({
    queryKey: ["goals", "options"],
    queryFn: async () => (await api.get<{ data: { id: number; name: string; completed_at: string | null }[] }>("/goals")).data.data,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      goal_id: form.goal_id ? Number(form.goal_id) : null,
      institution: form.institution || null,
      rate: needsRate && form.rate ? parseAmount(form.rate) : null,
      maturity_date: form.liquidity === "maturity" && form.maturity_date ? form.maturity_date : null,
      notes: form.notes || null,
      ...(investment ? {} : {
        invested_amount: form.invested_amount ? invested : null,
        current_balance: form.current_balance ? balance : null,
        start_date: form.start_date || null,
      }),
    };
    try {
      if (investment) await api.put(`/investments/${investment.id}`, payload);
      else await api.post("/investments", payload);
      toast.success(investment ? "Investimento atualizado" : "Investimento cadastrado 💕");
      invalidate();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={investment ? "Editar investimento" : "Novo investimento"} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="inv-form" loading={saving}>Salvar</Button></>}>
      <form id="inv-form" onSubmit={submit} className="space-y-5">
        {!investment && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Começar de um modelo</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setForm((f) => ({ ...f, ...p.v, name: f.name || p.label }))}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-left text-sm transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-500/10">
                  <span className="block font-medium text-slate-800 dark:text-slate-100">{p.label}</span>
                  <span className="block text-xs text-slate-500">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" error={errors.name}>
            <Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Caixinha Viagem, Reserva de emergência" invalid={!!errors.name} />
          </Field>
          <Field label="Instituição">
            <Input value={form.institution} onChange={(e) => set("institution", e.target.value)} placeholder="Ex.: Nubank, Inter, XP" />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
              {Object.entries(INVESTMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Como rende">
            <Select value={form.rate_type} onChange={(e) => set("rate_type", e.target.value)}>
              {Object.entries(RATE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          {needsRate && (
            <Field label={form.rate_type === "cdi" ? "Percentual do CDI" : form.rate_type === "ipca" ? "Taxa acima do IPCA (% a.a.)" : "Taxa (% ao ano)"} error={errors.rate}
              hint={form.rate_type === "cdi" ? "Caixinha Nubank: 100. Caixinha Turbo: 115." : undefined}>
              <div className="relative">
                <Input inputMode="decimal" value={form.rate} onChange={(e) => set("rate", e.target.value.replace(/[^\d,.]/g, ""))} placeholder={form.rate_type === "cdi" ? "100" : "12,5"} invalid={!!errors.rate} className="pr-10" />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">%</span>
              </div>
            </Field>
          )}
          <Field label="Guardando para a meta" hint="O “já guardado” da meta passa a ser o saldo desta caixinha">
            <Select value={form.goal_id} onChange={(e) => set("goal_id", e.target.value)}>
              <option value="">Nenhuma meta</option>
              {goals.filter((g) => !g.completed_at || String(g.id) === form.goal_id).map((g) => <option key={g.id} value={g.id}>🎯 {g.name}</option>)}
            </Select>
          </Field>
          <Field label="Liquidez">
            <Select value={form.liquidity} onChange={(e) => set("liquidity", e.target.value)}>
              <option value="daily">Diária (resgata quando quiser)</option>
              <option value="maturity">No vencimento</option>
            </Select>
          </Field>
          {form.liquidity === "maturity" && (
            <Field label="Vencimento"><DatePicker clearable placeholder="Data de vencimento" value={form.maturity_date} onChange={(v) => set("maturity_date", v)} /></Field>
          )}
        </div>

        {!investment && (
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-500/20 dark:bg-violet-500/5">
            <p className="mb-3 text-sm font-medium text-violet-800 dark:text-violet-300">Quanto tem nele hoje?</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Quanto vocês colocaram" hint="Soma dos aportes até hoje">
                <MoneyInput value={form.invested_amount} onChange={(v) => set("invested_amount", v)} />
              </Field>
              <Field label="Saldo hoje (no app)" hint="Valor que aparece no banco">
                <MoneyInput value={form.current_balance} onChange={(v) => set("current_balance", v)} />
              </Field>
              <Field label="Desde quando (opcional)" hint="Data do primeiro aporte">
                <DatePicker clearable placeholder="dd/mm/aaaa" value={form.start_date} onChange={(v) => set("start_date", v)} />
              </Field>
            </div>
            {invested > 0 && balance > 0 && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Rendimento até hoje: <strong className={balance - invested >= 0 ? "text-teal-600 dark:text-teal-400" : "text-rose-600"}>{money(balance - invested, { sign: true })}</strong>
                {" "}({percent(((balance - invested) / invested) * 100, 2)})
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cor" group><ColorPicker value={form.color} onChange={(c) => set("color", c)} /></Field>
          <Field label="Observações"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Opcional: objetivo, condições da Caixinha Turbo..." /></Field>
        </div>
        {investment && <Toggle checked={!form.is_active} onChange={(v) => set("is_active", !v)} label="Já resgatamos tudo (arquivar)" />}
      </form>
    </Modal>
  );
}


const MOVE_LABEL: Record<string, { label: string; tone: "green" | "red" | "violet" }> = {
  deposit: { label: "Aporte", tone: "green" },
  withdraw: { label: "Resgate", tone: "red" },
  balance: { label: "Saldo informado", tone: "violet" },
};

function HistoryModal({ investment, onClose }: { investment: Investment | null; onClose: () => void }) {
  const invalidate = useInvalidateFinance();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["investments", "movements", investment?.id],
    queryFn: async () => (await api.get<{ data: InvestmentMovement[] }>(`/investments/${investment!.id}/movements`)).data.data,
    enabled: !!investment,
  });

  const remove = async (m: InvestmentMovement) => {
    if (!confirm(`Excluir este ${MOVE_LABEL[m.type].label.toLowerCase()} de ${money(m.amount)}?`)) return;
    await api.delete(`/investments/${investment!.id}/movements/${m.id}`);
    refetch();
    invalidate();
  };

  return (
    <Modal open={!!investment} onClose={onClose} title={`Histórico: ${investment?.name ?? ""}`}>
      {isLoading ? <Skeleton className="h-40" /> : !data?.length ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhuma movimentação.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((m) => (
            <li key={m.id} className="group flex items-center gap-3 py-2.5 text-sm">
              <Badge tone={MOVE_LABEL[m.type].tone}>{MOVE_LABEL[m.type].label}</Badge>
              <span className="min-w-0 flex-1">
                <span className="block text-slate-700 dark:text-slate-200">
                  {fmtDate(m.date)}{m.is_opening && " · saldo do cadastro"}
                  {m.account && <span className="text-slate-500"> · {m.type === "deposit" ? "saiu de" : "voltou para"} {m.account.name}</span>}
                </span>
                {m.note && <span className="block truncate text-xs text-slate-500">{m.note}</span>}
              </span>
              <span className={cn("tabular font-medium", m.type === "withdraw" ? "text-rose-600" : "text-slate-900 dark:text-white")}>
                {m.type === "withdraw" ? "−" : m.type === "deposit" ? "+" : ""}{money(m.amount)}
              </span>
              <button onClick={() => remove(m)} className="rounded-md p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600" aria-label="Excluir movimentação">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ---------------------------------- Extrato ---------------------------------- */

interface StatementResponse {
  data: (InvestmentMovement & { investment: { id: number; name: string; institution: string | null; color: string } })[];
  meta: { current_page: number; last_page: number; total: number };
  totals: { deposits: number; withdrawals: number; net: number; count: number };
}

/** Todas as aplicações, resgates e atualizações de saldo, com filtros. */
function Statement({ investments }: { investments: Investment[] }) {
  const [investmentId, setInvestmentId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const params = { investment_id: investmentId || undefined, type: type || undefined, from: from || undefined, to: to || undefined, page };
  const { data, isLoading } = useQuery({
    queryKey: ["investments", "statement", params],
    queryFn: async () => (await api.get<StatementResponse>("/investment-movements", { params })).data,
    placeholderData: (p) => p,
  });
  // Mudou filtro: volta para a página 1.
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <>
      <Card className="mb-4" padded={false}>
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={investmentId} onChange={(e) => reset(() => setInvestmentId(e.target.value))}>
            <option value="">Todos os investimentos</option>
            {investments.map((i) => <option key={i.id} value={i.id} data-color={i.color}>{i.name}{i.institution ? ` · ${i.institution}` : ""}</option>)}
          </Select>
          <Select value={type} onChange={(e) => reset(() => setType(e.target.value))}>
            <option value="">Aplicações, resgates e saldos</option>
            <option value="deposit">Só aplicações</option>
            <option value="withdraw">Só resgates</option>
            <option value="balance">Só atualizações de saldo</option>
          </Select>
          <DatePicker clearable placeholder="De (data)" value={from} onChange={(v) => reset(() => setFrom(v))} />
          <DatePicker clearable placeholder="Até (data)" value={to} onChange={(v) => reset(() => setTo(v))} />
        </div>
      </Card>

      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniTotal label="Aplicado" value={money(data.totals.deposits)} tone="text-violet-600 dark:text-violet-400" />
          <MiniTotal label="Resgatado" value={money(data.totals.withdrawals)} tone="text-rose-600" />
          <MiniTotal label="Aplicado líquido" value={money(data.totals.net)} />
          <MiniTotal label="Movimentações" value={String(data.totals.count)} />
        </div>
      )}

      <Card padded={false}>
        {isLoading ? <div className="p-4"><Skeleton className="h-48" /></div> : !data?.data.length ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="Nenhuma movimentação no filtro" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase dark:bg-slate-800/50">
                <tr>
                  <th className="px-5 py-3">Data</th><th className="px-3 py-3">Investimento</th><th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Conta</th><th className="px-3 py-3">Observação</th><th className="px-5 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.data.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="tabular px-5 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-400">{fmtDate(m.date)}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.investment.color }} />
                        <span className="font-medium text-slate-800 dark:text-slate-100">{m.investment.name}</span>
                        {m.investment.institution && <span className="text-xs text-slate-500">{m.investment.institution}</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={MOVE_LABEL[m.type].tone}>{MOVE_LABEL[m.type].label}</Badge>
                      {m.is_opening && <span className="ml-1 text-xs text-slate-400">cadastro</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{m.account?.name ?? "—"}</td>
                    <td className="max-w-56 truncate px-3 py-2.5 text-slate-500">{m.note ?? ""}</td>
                    <td className={cn("tabular px-5 py-2.5 text-right font-semibold whitespace-nowrap",
                      m.type === "withdraw" ? "text-rose-600" : m.type === "deposit" ? "text-violet-600 dark:text-violet-400" : "text-slate-700 dark:text-slate-200")}>
                      {m.type === "withdraw" ? "−" : m.type === "deposit" ? "+" : ""}{money(m.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}
      </Card>
    </>
  );
}

function MiniTotal({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("tabular text-lg font-bold text-slate-900 dark:text-white", tone)}>{value}</p>
    </div>
  );
}
