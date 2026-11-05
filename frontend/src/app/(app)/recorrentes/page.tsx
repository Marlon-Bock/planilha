"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Repeat, Trash2 } from "lucide-react";
import { api, parseError, type FieldErrors } from "@/lib/api";
import { cn, fmtDate, FREQUENCIES, money, parseAmount, PAYMENT_METHODS, today } from "@/lib/format";
import { useAccounts, useCategories, useInvalidateFinance } from "@/lib/queries";
import type { Recurring } from "@/lib/types";
import { Badge, Button, Card, Carousel, ConfirmDialog, DatePicker, Dot, EmptyState, Field, Input, Modal, MoneyInput, PageHeader, Select, Skeleton, Textarea, Toggle } from "@/components/ui";
import { CategoryIcon } from "@/components/icons";
import { tr } from "@/lib/i18n";

export default function RecurringPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["recurring"],
    queryFn: async () => (await api.get<{ data: Recurring[]; summary: { monthly_income: number; monthly_expense: number } }>("/recurring")).data,
  });
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Recurring | null>(null);
  const [deletePending, setDeletePending] = useState(true);
  const invalidate = useInvalidateFinance();

  const generate = async () => {
    const { data } = await api.post<{ generated: number }>("/recurring/generate");
    toast.success(data.generated ? tr(`${data.generated} lançamento(s) gerado(s)`, `${data.generated} transaction(s) generated`) : tr("Tudo em dia — nenhum lançamento novo", "All up to date — no new transactions"));
    invalidate();
  };

  const remove = async () => {
    await api.delete(`/recurring/${toDelete!.id}`, { params: { delete_pending: deletePending ? 1 : 0 } });
    toast.success(tr("Recorrência excluída", "Recurring deleted"));
    setToDelete(null);
    invalidate();
  };

  const s = data?.summary;

  return (
    <>
      <PageHeader title={tr("Recorrentes", "Recurring")} description={tr("Contas fixas e receitas que se repetem: aluguel, salário, assinaturas...", "Fixed bills and income that repeat: rent, salary, subscriptions...")}
        actions={<>
          <Button variant="outline" onClick={generate}><RefreshCw className="h-4 w-4" /> {tr("Gerar lançamentos", "Generate transactions")}</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> {tr("Nova recorrência", "New recurring")}</Button>
        </>} />

      {s && (
        <Carousel className="mb-6 sm:grid-cols-3">
          <Box label={tr("Receitas fixas / mês", "Fixed income / month")} value={s.monthly_income} tone="text-teal-600 dark:text-teal-400" />
          <Box label={tr("Despesas fixas / mês", "Fixed expenses / month")} value={s.monthly_expense} tone="text-rose-600 dark:text-rose-400" />
          <Box label={tr("Sobra após contas fixas", "Left after fixed bills")} value={s.monthly_income - s.monthly_expense} />
        </Carousel>
      )}

      <Card padded={false}>
        {isLoading ? <div className="p-4"><Skeleton className="h-48" /></div> : !data?.data.length ? (
          <EmptyState icon={<Repeat className="h-6 w-6" />} title={tr("Nenhuma recorrência", "No recurring items")} description={tr("Cadastre suas contas fixas e o sistema cria os lançamentos todo mês automaticamente.", "Add your fixed bills and the app creates the transactions every month automatically.")}
            action={<Button onClick={() => setOpen(true)}>{tr("Criar recorrência", "Create recurring")}</Button>} />
        ) : (
          <>
          {/* Celular: lista (toque para editar). */}
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {data.data.map((r) => (
              <li key={r.id} className={cn("flex items-center pr-2", !r.is_active && "opacity-50")}>
                <button type="button" onClick={() => { setEditing(r); setOpen(true); }} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left active:bg-slate-50 dark:active:bg-slate-800">
                  <CategoryIcon icon={r.category?.icon} color={r.category?.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-slate-900 dark:text-white">{r.description}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {FREQUENCIES[r.frequency]} · {r.account?.name} · {r.is_active ? tr(`próxima ${fmtDate(r.next_date, "dd/MM")}`, `next ${fmtDate(r.next_date, "dd/MM")}`) : tr("inativa", "inactive")}
                    </span>
                  </span>
                  <span className={cn("tabular shrink-0 text-[15px] font-semibold", r.type === "income" ? "text-teal-600 dark:text-teal-400" : "text-slate-900 dark:text-white")}>
                    {r.type === "income" ? "+" : "−"}{money(r.amount)}
                  </span>
                </button>
                <button type="button" onClick={() => setToDelete(r)} aria-label={tr(`Excluir ${r.description}`, `Delete ${r.description}`)}
                  className="ml-1 rounded-lg p-2.5 text-slate-300 active:bg-rose-50 active:text-rose-600 dark:text-slate-600">
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase dark:bg-slate-800/50">
                <tr><th className="px-5 py-3">{tr("Descrição", "Description")}</th><th className="px-3 py-3">{tr("Frequência", "Frequency")}</th><th className="px-3 py-3">{tr("Conta", "Account")}</th><th className="px-3 py-3">{tr("Próxima", "Next")}</th><th className="px-3 py-3 text-right">{tr("Valor", "Amount")}</th><th className="w-20" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.data.map((r) => (
                  <tr key={r.id} className={cn("group", !r.is_active && "opacity-50")}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <CategoryIcon icon={r.category?.icon} color={r.category?.color} size="sm" />
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">{r.description}</p>
                          <p className="text-xs text-slate-500">{r.category?.name ?? tr("Sem categoria", "No category")} · {tr(`${r.transactions_count} gerado(s)`, `${r.transactions_count} generated`)}{r.auto_paid && tr(" · baixa automática", " · auto-paid")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Badge tone="violet">{FREQUENCIES[r.frequency]}</Badge></td>
                    <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400"><Dot color={r.account?.color} />{r.account?.name}</span></td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{r.is_active ? fmtDate(r.next_date) : <Badge>{tr("Inativa", "Inactive")}</Badge>}{r.end_date && <span className="block text-xs">{tr("até", "until")} {fmtDate(r.end_date)}</span>}</td>
                    <td className={cn("tabular px-3 py-3 text-right font-semibold", r.type === "income" ? "text-teal-600 dark:text-teal-400" : "text-slate-900 dark:text-white")}>
                      {r.type === "income" ? "+" : "−"}{money(r.amount)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end opacity-60 group-hover:opacity-100">
                        <button className="rounded-md p-1.5 text-slate-400 hover:text-slate-700" onClick={() => { setEditing(r); setOpen(true); }} aria-label={tr("Editar", "Edit")}><Pencil className="h-4 w-4" /></button>
                        <button className="rounded-md p-1.5 text-slate-400 hover:text-rose-600" onClick={() => setToDelete(r)} aria-label={tr("Excluir", "Delete")}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <RecurringForm open={open} onClose={() => setOpen(false)} recurring={editing} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title={tr("Excluir recorrência", "Delete recurring")} confirmLabel={tr("Excluir", "Delete")}
        message={<>{tr("Excluir ", "Delete ")}<strong>{toDelete?.description}</strong>{tr("? Lançamentos já pagos são mantidos.", "? Already paid transactions are kept.")}</>}>
        <Toggle checked={deletePending} onChange={setDeletePending} label={tr("Excluir também os lançamentos futuros em aberto", "Also delete future unpaid transactions")} />
      </ConfirmDialog>
    </>
  );
}

function Box({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn("tabular mt-1 text-xl font-bold", tone ?? (value < 0 ? "text-rose-600" : "text-slate-900 dark:text-white"))}>{money(value)}</p>
    </div>
  );
}

type RecurringFormProps = { open: boolean; onClose: () => void; recurring: Recurring | null };

function RecurringForm(props: RecurringFormProps) {
  return props.open ? <RecurringFormInner key={props.recurring?.id ?? "new"} {...props} /> : null;
}

function RecurringFormInner({ onClose, recurring }: RecurringFormProps) {
  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.data ?? [];
  const [form, setForm] = useState(() => recurring ? {
    type: recurring.type as string, description: recurring.description, amount: String(recurring.amount).replace(".", ","), frequency: recurring.frequency as string,
    start_date: recurring.start_date, end_date: recurring.end_date ?? "", account_id: String(recurring.account_id), category_id: recurring.category_id ? String(recurring.category_id) : "",
    payment_method: recurring.payment_method ?? "", auto_paid: recurring.auto_paid, is_active: recurring.is_active, notes: recurring.notes ?? "",
  } : {
    type: "expense", description: "", amount: "", frequency: "monthly", start_date: today(), end_date: "", account_id: accounts[0] ? String(accounts[0].id) : "",
    category_id: "", payment_method: "", auto_paid: false, is_active: true, notes: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const { data: categories = [] } = useCategories();
  const invalidate = useInvalidateFinance();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form, amount: parseAmount(form.amount), account_id: Number(form.account_id) || null, category_id: form.category_id ? Number(form.category_id) : null,
      end_date: form.end_date || null, payment_method: form.payment_method || null, notes: form.notes || null,
    };
    try {
      if (recurring) {
        await api.put(`/recurring/${recurring.id}`, payload);
        toast.success(tr("Recorrência atualizada (lançamentos futuros em aberto também)", "Recurring updated (future unpaid transactions too)"));
      } else {
        const { data } = await api.post<{ generated: number }>("/recurring", payload);
        toast.success(tr(`Recorrência criada — ${data.generated} lançamento(s) gerado(s)`, `Recurring created — ${data.generated} transaction(s) generated`));
      }
      invalidate();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={recurring ? tr("Editar recorrência", "Edit recurring") : tr("Nova recorrência", "New recurring")}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancelar", "Cancel")}</Button><Button type="submit" form="rec-form" loading={saving}>{tr("Salvar", "Save")}</Button></>}>
      <form id="rec-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={tr("Tipo", "Type")}>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, category_id: "" })}>
            <option value="expense">{tr("Despesa", "Expense")}</option><option value="income">{tr("Receita", "Income")}</option>
          </Select>
        </Field>
        <Field label={tr("Frequência", "Frequency")}><Select value={form.frequency} onChange={(e) => set("frequency", e.target.value)}>{Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label={tr("Descrição", "Description")} error={errors.description} className="sm:col-span-2"><Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={tr("Ex.: Aluguel, Netflix, Salário", "E.g. Rent, Netflix, Salary")} /></Field>
        <Field label={tr("Valor", "Amount")} error={errors.amount}><MoneyInput value={form.amount} onChange={(v) => set("amount", v)} /></Field>
        <Field label={tr("Conta", "Account")} error={errors.account_id}><Select value={form.account_id} onChange={(e) => set("account_id", e.target.value)}><option value="">{tr("Selecione", "Select")}</option>{accounts.map((a) => <option key={a.id} value={a.id} data-color={a.color}>{a.name}</option>)}</Select></Field>
        <Field label={tr("Categoria", "Category")}><Select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}><option value="">{tr("Sem categoria", "No category")}</option>{categories.filter((c) => c.type === form.type).map((c) => <option key={c.id} value={c.id} data-color={c.color}>{c.name}</option>)}</Select></Field>
        <Field label={tr("Forma de pagamento", "Payment method")}><Select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}><option value="">{tr("Não informado", "Not specified")}</option>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label={tr("Primeira ocorrência", "First occurrence")} error={errors.start_date} hint={recurring ? tr("Alterar não regenera lançamentos já criados", "Changing it doesn't regenerate existing transactions") : undefined}><DatePicker value={form.start_date} onChange={(v) => set("start_date", v)} /></Field>
        <Field label={tr("Termina em (opcional)", "Ends on (optional)")} error={errors.end_date}><DatePicker clearable placeholder={tr("Sem data de término", "No end date")} value={form.end_date} onChange={(v) => set("end_date", v)} /></Field>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Toggle checked={form.auto_paid} onChange={(v) => set("auto_paid", v)} label={tr("Dar baixa automaticamente na data (débito automático)", "Mark as paid automatically on the date (auto-debit)")} />
          {recurring && <Toggle checked={form.is_active} onChange={(v) => set("is_active", v)} label={tr("Ativa", "Active")} />}
        </div>
        <Field label={tr("Observações", "Notes")} className="sm:col-span-2"><Textarea placeholder={tr("Opcional: contrato, nº do cliente, detalhes...", "Optional: contract, customer number, details...")} value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></Field>
      </form>
    </Modal>
  );
}
