"use client";

import { TxLink } from "@/components/filter-link";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, PiggyBank, Plus, Trash2 } from "lucide-react";
import { api, parseError } from "@/lib/api";
import { cn, currentMonth, money, monthLabel, parseAmount, percent } from "@/lib/format";
import { useCategories, useInvalidateFinance } from "@/lib/queries";
import type { Budget } from "@/lib/types";
import { Button, Card, cuteHover, EmptyState, Field, Modal, MoneyInput, MonthPicker, PageHeader, Progress, Select, Skeleton } from "@/components/ui";
import { CategoryIcon } from "@/components/icons";
import { tr } from "@/lib/i18n";

interface BudgetResponse { month: string; data: Budget[]; summary: { budgeted: number; spent: number; remaining: number; over_count: number } }

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const invalidate = useInvalidateFinance();
  const { data, isLoading } = useQuery({
    queryKey: ["budgets", month],
    queryFn: async () => (await api.get<BudgetResponse>("/budgets", { params: { month } })).data,
  });

  const copy = async () => {
    const { data } = await api.post<{ copied: number }>("/budgets/copy", { month });
    toast[data.copied ? "success" : "info"](data.copied ? tr(`${data.copied} orçamento(s) copiado(s) do mês anterior`, `${data.copied} budget(s) copied from last month`) : tr("Nada novo para copiar do mês anterior", "Nothing new to copy from last month"));
    invalidate();
  };

  const remove = async (b: Budget) => {
    if (!confirm(tr(`Remover o orçamento de ${b.category.name}?`, `Remove the budget for ${b.category.name}?`))) return;
    await api.delete(`/budgets/${b.id}`);
    invalidate();
  };

  const s = data?.summary;

  return (
    <>
      <PageHeader title={tr("Orçamentos", "Budgets")} description={tr("Defina limites de gasto por categoria e acompanhe durante o mês", "Set spending limits per category and track them during the month")}
        actions={<>
          <MonthPicker value={month} onChange={setMonth} />
          <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" /> {tr("Copiar do mês anterior", "Copy from last month")}</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> {tr("Novo orçamento", "New budget")}</Button>
        </>} />

      {s && s.budgeted > 0 && (
        <Card className="mb-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label={tr("Orçado", "Budgeted")} value={money(s.budgeted)} />
            <Metric label={tr("Gasto", "Spent")} value={money(s.spent)} />
            <Metric label={tr("Disponível", "Available")} value={money(s.remaining)} tone={s.remaining < 0 ? "text-rose-600" : "text-teal-600 dark:text-teal-400"} />
            <Metric label={tr("Categorias estouradas", "Categories over budget")} value={String(s.over_count)} tone={s.over_count ? "text-rose-600" : undefined} />
          </div>
          <Progress value={(s.spent / s.budgeted) * 100} className="mt-4 h-3" />
          <p className="mt-1.5 text-xs text-slate-500">{tr(`${percent((s.spent / s.budgeted) * 100, 0)} do orçamento total de ${monthLabel(month).toLowerCase()} utilizado`, `${percent((s.spent / s.budgeted) * 100, 0)} of the ${monthLabel(month)} total budget used`)}</p>
        </Card>
      )}

      {isLoading ? <Skeleton className="h-64" /> : !data?.data.length ? (
        <Card>
          <EmptyState icon={<PiggyBank className="h-6 w-6" />} title={tr("Nenhum orçamento neste mês", "No budgets this month")}
            description={tr("Crie limites para as categorias em que você mais gasta. Você recebe um aviso ao atingir 80% e 100%.", "Create limits for the categories you spend the most on. You get an alert at 80% and 100%.")}
            action={<div className="flex gap-2"><Button variant="outline" onClick={copy}>{tr("Copiar do mês anterior", "Copy from last month")}</Button><Button onClick={() => setOpen(true)}>{tr("Criar orçamento", "Create budget")}</Button></div>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((b) => (
            <div key={b.id} className={cn("group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", cuteHover)}>
              <div className="flex items-center gap-3">
                <CategoryIcon icon={b.category.icon} color={b.category.color} />
                <TxLink filters={{ month, category_ids: [b.category_id] }} className="flex-1 font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100">{b.category.name}</TxLink>
                <button onClick={() => { setEditing(b); setOpen(true); }} className="text-xs text-brand-600 opacity-0 group-hover:opacity-100 hover:underline">{tr("Editar", "Edit")}</button>
                <button onClick={() => remove(b)} className="text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-600" aria-label={tr("Remover", "Remove")}><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="tabular text-xl font-bold text-slate-900 dark:text-white">{money(b.spent)}</p>
                  <p className="text-xs text-slate-500">{tr("de", "of")} {money(b.amount)}</p>
                </div>
                <span className={cn("text-sm font-semibold", b.percent >= 100 ? "text-rose-600" : b.percent >= 80 ? "text-amber-600" : "text-teal-600")}>{percent(b.percent, 0)}</span>
              </div>
              <Progress value={b.percent} className="mt-3" />
              <p className={cn("mt-2 text-xs", b.remaining < 0 ? "text-rose-600" : "text-slate-500")}>
                {b.remaining < 0 ? tr(`Estourou em ${money(-b.remaining)}`, `Over by ${money(-b.remaining)}`) : tr(`Restam ${money(b.remaining)}`, `${money(b.remaining)} left`)}
              </p>
            </div>
          ))}
        </div>
      )}

      <BudgetForm open={open} onClose={() => setOpen(false)} month={month} budget={editing} existing={data?.data.map((b) => b.category_id) ?? []} />
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className={cn("tabular text-xl font-bold text-slate-900 dark:text-white", tone)}>{value}</p></div>;
}

function BudgetForm({ open, onClose, month, budget, existing }: { open: boolean; onClose: () => void; month: string; budget: Budget | null; existing: number[] }) {
  const { data: categories = [] } = useCategories();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateFinance();
  const [lastKey, setLastKey] = useState("");

  // Reinicia o formulário sempre que abrir.
  const key = `${open}-${budget?.id}`;
  if (key !== lastKey) {
    setLastKey(key);
    setCategoryId(budget ? String(budget.category_id) : "");
    setAmount(budget ? String(budget.amount).replace(".", ",") : "");
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (budget) await api.put(`/budgets/${budget.id}`, { amount: parseAmount(amount) });
      else await api.post("/budgets", { category_id: Number(categoryId), month, amount: parseAmount(amount) });
      toast.success(tr("Orçamento salvo", "Budget saved"));
      invalidate();
      onClose();
    } catch (err) { toast.error(parseError(err).message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={budget ? `${tr("Orçamento", "Budget")}: ${budget.category.name}` : `${tr("Novo orçamento", "New budget")} — ${monthLabel(month)}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancelar", "Cancel")}</Button><Button type="submit" form="budget-form" loading={saving}>{tr("Salvar", "Save")}</Button></>}>
      <form id="budget-form" onSubmit={submit} className="space-y-4">
        {!budget && (
          <Field label={tr("Categoria", "Category")}>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">{tr("Selecione", "Select")}</option>
              {categories.filter((c) => c.type === "expense" && !c.is_archived && !existing.includes(c.id)).map((c) => <option key={c.id} value={c.id} data-color={c.color}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label={tr("Limite mensal", "Monthly limit")}><MoneyInput autoFocus value={amount} onChange={(v) => setAmount(v)} required /></Field>
      </form>
    </Modal>
  );
}
