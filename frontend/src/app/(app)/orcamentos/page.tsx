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
    toast[data.copied ? "success" : "info"](data.copied ? `${data.copied} orçamento(s) copiado(s) do mês anterior` : "Nada novo para copiar do mês anterior");
    invalidate();
  };

  const remove = async (b: Budget) => {
    if (!confirm(`Remover o orçamento de ${b.category.name}?`)) return;
    await api.delete(`/budgets/${b.id}`);
    invalidate();
  };

  const s = data?.summary;

  return (
    <>
      <PageHeader title="Orçamentos" description="Defina limites de gasto por categoria e acompanhe durante o mês"
        actions={<>
          <MonthPicker value={month} onChange={setMonth} />
          <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" /> Copiar do mês anterior</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Novo orçamento</Button>
        </>} />

      {s && s.budgeted > 0 && (
        <Card className="mb-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <Metric label="Orçado" value={money(s.budgeted)} />
            <Metric label="Gasto" value={money(s.spent)} />
            <Metric label="Disponível" value={money(s.remaining)} tone={s.remaining < 0 ? "text-rose-600" : "text-teal-600 dark:text-teal-400"} />
            <Metric label="Categorias estouradas" value={String(s.over_count)} tone={s.over_count ? "text-rose-600" : undefined} />
          </div>
          <Progress value={(s.spent / s.budgeted) * 100} className="mt-4 h-3" />
          <p className="mt-1.5 text-xs text-slate-500">{percent((s.spent / s.budgeted) * 100, 0)} do orçamento total de {monthLabel(month).toLowerCase()} utilizado</p>
        </Card>
      )}

      {isLoading ? <Skeleton className="h-64" /> : !data?.data.length ? (
        <Card>
          <EmptyState icon={<PiggyBank className="h-6 w-6" />} title="Nenhum orçamento neste mês"
            description="Crie limites para as categorias em que você mais gasta. Você recebe um aviso ao atingir 80% e 100%."
            action={<div className="flex gap-2"><Button variant="outline" onClick={copy}>Copiar do mês anterior</Button><Button onClick={() => setOpen(true)}>Criar orçamento</Button></div>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((b) => (
            <div key={b.id} className={cn("group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", cuteHover)}>
              <div className="flex items-center gap-3">
                <CategoryIcon icon={b.category.icon} color={b.category.color} />
                <TxLink filters={{ month, category_ids: [b.category_id] }} className="flex-1 font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100">{b.category.name}</TxLink>
                <button onClick={() => { setEditing(b); setOpen(true); }} className="text-xs text-brand-600 opacity-0 group-hover:opacity-100 hover:underline">Editar</button>
                <button onClick={() => remove(b)} className="text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-600" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="tabular text-xl font-bold text-slate-900 dark:text-white">{money(b.spent)}</p>
                  <p className="text-xs text-slate-500">de {money(b.amount)}</p>
                </div>
                <span className={cn("text-sm font-semibold", b.percent >= 100 ? "text-rose-600" : b.percent >= 80 ? "text-amber-600" : "text-teal-600")}>{percent(b.percent, 0)}</span>
              </div>
              <Progress value={b.percent} className="mt-3" />
              <p className={cn("mt-2 text-xs", b.remaining < 0 ? "text-rose-600" : "text-slate-500")}>
                {b.remaining < 0 ? `Estourou em ${money(-b.remaining)}` : `Restam ${money(b.remaining)}`}
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
      toast.success("Orçamento salvo");
      invalidate();
      onClose();
    } catch (err) { toast.error(parseError(err).message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={budget ? `Orçamento: ${budget.category.name}` : `Novo orçamento — ${monthLabel(month)}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="budget-form" loading={saving}>Salvar</Button></>}>
      <form id="budget-form" onSubmit={submit} className="space-y-4">
        {!budget && (
          <Field label="Categoria">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Selecione</option>
              {categories.filter((c) => c.type === "expense" && !c.is_archived && !existing.includes(c.id)).map((c) => <option key={c.id} value={c.id} data-color={c.color}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Limite mensal"><MoneyInput autoFocus value={amount} onChange={(v) => setAmount(v)} required /></Field>
      </form>
    </Modal>
  );
}
