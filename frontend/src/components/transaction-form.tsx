"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, parseError, type FieldErrors } from "@/lib/api";
import { cn, money, parseAmount, PAYMENT_METHODS, today, TX_TYPES } from "@/lib/format";
import { useAccounts, useCategories, useInvalidateFinance, useTags } from "@/lib/queries";
import type { Transaction, TxType } from "@/lib/types";
import { Button, DatePicker, Field, Input, Modal, MoneyInput, NumberStepper, Select, Textarea, Toggle } from "@/components/ui";
import { tr } from "@/lib/i18n";

export type TxDefaults = Partial<Pick<Transaction, "type" | "date" | "account_id" | "category_id">>;

interface FormState {
  type: TxType;
  description: string;
  amount: string;
  date: string;
  account_id: string;
  transfer_account_id: string;
  category_id: string;
  payment_method: string;
  is_paid: boolean;
  paid_at: string;
  notes: string;
  tag_ids: number[];
  installments: string;
  installment_mode: "split" | "repeat";
  apply_to: "this" | "future" | "all";
}

const empty = (d?: TxDefaults): FormState => ({
  type: d?.type ?? "expense",
  description: "",
  amount: "",
  date: d?.date ?? today(),
  account_id: d?.account_id ? String(d.account_id) : "",
  transfer_account_id: "",
  category_id: d?.category_id ? String(d.category_id) : "",
  payment_method: "",
  is_paid: false,
  paid_at: "",
  notes: "",
  tag_ids: [],
  installments: "1",
  installment_mode: "split",
  apply_to: "this",
});

const fromTx = (t: Transaction): FormState => ({
  type: t.type,
  description: t.description,
  amount: String(t.amount).replace(".", ","),
  date: t.date,
  account_id: String(t.account_id),
  transfer_account_id: t.transfer_account_id ? String(t.transfer_account_id) : "",
  category_id: t.category_id ? String(t.category_id) : "",
  payment_method: t.payment_method ?? "",
  is_paid: t.is_paid,
  paid_at: t.paid_at ?? "",
  notes: t.notes ?? "",
  tag_ids: t.tags?.map((x) => x.id) ?? [],
  installments: "1",
  installment_mode: "split",
  apply_to: "this",
});

const typeTabs: { value: TxType; label: string; active: string }[] = [
  { value: "expense", label: "Despesa", active: "bg-rose-600 text-white" },
  { value: "income", label: "Receita", active: "bg-emerald-600 text-white" },
  { value: "transfer", label: "Transferência", active: "bg-sky-600 text-white" },
];

type Props = { open: boolean; onClose: () => void; transaction?: Transaction | null; defaults?: TxDefaults };

/** Só monta o formulário quando aberto, para o estado sempre partir do lançamento/padrões atuais. */
export function TransactionForm(props: Props) {
  if (!props.open) return null;
  return <TransactionFormInner key={props.transaction?.id ?? "new"} {...props} />;
}

function TransactionFormInner({ onClose, transaction, defaults }: Props) {
  const [form, setForm] = useState<FormState>(() => (transaction ? fromTx(transaction) : empty(defaults)));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const { data: accountsData } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const invalidate = useInvalidateFinance();
  const accounts = accountsData?.data ?? [];
  const isEdit = !!transaction;
  // Sem conta escolhida, usa a primeira da lista.
  const accountId = form.account_id || (accounts[0] ? String(accounts[0].id) : "");

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const cats = useMemo(() => categories.filter((c) => c.type === form.type && !c.is_archived), [categories, form.type]);
  const n = Math.max(1, Number(form.installments) || 1);
  const amount = parseAmount(form.amount || "0");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = {
      type: form.type,
      description: form.description,
      amount,
      date: form.date,
      account_id: Number(accountId) || null,
      transfer_account_id: form.type === "transfer" ? Number(form.transfer_account_id) || null : null,
      category_id: form.type !== "transfer" && form.category_id ? Number(form.category_id) : null,
      payment_method: form.payment_method || null,
      is_paid: form.is_paid,
      paid_at: form.is_paid ? form.paid_at || null : null,
      notes: form.notes || null,
      tag_ids: form.tag_ids,
      ...(isEdit ? { apply_to: form.apply_to } : { installments: n, installment_mode: form.installment_mode }),
    };
    try {
      if (isEdit) {
        await api.put(`/transactions/${transaction!.id}`, payload);
        toast.success(tr("Lançamento atualizado", "Transaction updated"));
      } else {
        const { data } = await api.post<{ created: number }>("/transactions", payload);
        toast.success(data.created > 1 ? tr(`${data.created} parcelas criadas`, `${data.created} installments created`) : tr("Lançamento criado", "Transaction created"));
      }
      await invalidate();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? tr("Editar lançamento", "Edit transaction") : tr("Novo lançamento", "New transaction")} size="md"
      footer={<>
        <Button variant="ghost" type="button" onClick={onClose}>{tr("Cancelar", "Cancel")}</Button>
        <Button type="submit" form="tx-form" loading={saving}>{isEdit ? tr("Salvar", "Save") : tr("Adicionar", "Add")}</Button>
      </>}>
      <form id="tx-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {typeTabs.map((t) => (
            <button key={t.value} type="button" onClick={() => setForm((f) => ({ ...f, type: t.value, category_id: "" }))}
              className={cn("rounded-lg py-2 text-sm font-medium transition", form.type === t.value ? t.active : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700")}>
              {TX_TYPES[t.value]}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("Descrição", "Description")} error={errors.description} className="sm:col-span-2">
            <Input autoFocus value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={tr("Ex.: Supermercado, Aluguel, Salário...", "E.g. Groceries, Rent, Salary...")} invalid={!!errors.description} />
          </Field>
          <Field label={n > 1 && form.installment_mode === "split" ? tr("Valor total", "Total amount") : tr("Valor", "Amount")} error={errors.amount}>
            <MoneyInput value={form.amount} onChange={(v) => set("amount", v)} invalid={!!errors.amount} className="tabular" />
          </Field>
          <Field label={tr("Data / vencimento", "Date / due date")} error={errors.date}>
            <DatePicker value={form.date} onChange={(v) => set("date", v)} invalid={!!errors.date} />
          </Field>
          <Field label={form.type === "transfer" ? tr("Conta de origem", "From account") : tr("Conta", "Account")} error={errors.account_id}>
            <Select value={accountId} onChange={(e) => set("account_id", e.target.value)} invalid={!!errors.account_id}>
              <option value="">{tr("Selecione", "Select")}</option>
              {accounts.map((a) => <option key={a.id} value={a.id} data-color={a.color}>{a.name}</option>)}
            </Select>
          </Field>
          {form.type === "transfer" ? (
            <Field label={tr("Conta de destino", "To account")} error={errors.transfer_account_id}>
              <Select value={form.transfer_account_id} onChange={(e) => set("transfer_account_id", e.target.value)} invalid={!!errors.transfer_account_id}>
                <option value="">{tr("Selecione", "Select")}</option>
                {accounts.filter((a) => String(a.id) !== accountId).map((a) => <option key={a.id} value={a.id} data-color={a.color}>{a.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label={tr("Categoria", "Category")} error={errors.category_id}>
              <Select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">{tr("Sem categoria", "No category")}</option>
                {cats.map((c) => <option key={c.id} value={c.id} data-color={c.color}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label={tr("Forma de pagamento", "Payment method")}>
            <Select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
              <option value="">{tr("Não informado", "Not specified")}</option>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <Toggle checked={form.is_paid} onChange={(v) => set("is_paid", v)} label={form.type === "income" ? tr("Recebido", "Received") : tr("Pago", "Paid")} />
            {form.is_paid && <DatePicker value={form.paid_at || form.date} onChange={(v) => set("paid_at", v)} className="h-9" />}
          </div>
        </div>

        {!isEdit && form.type !== "transfer" && (
          <div className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tr("Parcelas", "Installments")} hint={tr("1 = à vista", "1 = paid in full")}>
                <NumberStepper value={form.installments} min={1} max={120} suffix="x" onChange={(v) => set("installments", String(v))} />
              </Field>
              {n > 1 && (
                <Field label={tr("O valor informado é", "The amount entered is")}>
                  <Select value={form.installment_mode} onChange={(e) => set("installment_mode", e.target.value as FormState["installment_mode"])}>
                    <option value="split">{tr("Total (dividir entre as parcelas)", "The total (split across installments)")}</option>
                    <option value="repeat">{tr("De cada parcela", "Per installment")}</option>
                  </Select>
                </Field>
              )}
            </div>
            {n > 1 && amount > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                {tr(`${n}x de `, `${n}x of `)}<strong>{money(form.installment_mode === "split" ? amount / n : amount)}</strong>{tr(" — total ", " — total ")}{money(form.installment_mode === "split" ? amount : amount * n)}{tr(", uma por mês a partir da data informada.", ", one per month starting on the chosen date.")}
              </p>
            )}
          </div>
        )}

        {isEdit && transaction?.installment_group && (
          <Field label={tr(`Esta é a parcela ${transaction.installment_number}/${transaction.installment_total}. Aplicar alterações em:`, `This is installment ${transaction.installment_number}/${transaction.installment_total}. Apply changes to:`)}>
            <Select value={form.apply_to} onChange={(e) => set("apply_to", e.target.value as FormState["apply_to"])}>
              <option value="this">{tr("Somente nesta parcela", "Only this installment")}</option>
              <option value="future">{tr("Nesta e nas próximas", "This and the next ones")}</option>
              <option value="all">{tr("Em todas as parcelas", "All installments")}</option>
            </Select>
          </Field>
        )}

        {tags.length > 0 && (
          <Field label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const on = form.tag_ids.includes(t.id);
                return (
                  <button key={t.id} type="button"
                    onClick={() => set("tag_ids", on ? form.tag_ids.filter((x) => x !== t.id) : [...form.tag_ids, t.id])}
                    className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition", on ? "text-white" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300")}
                    style={on ? { backgroundColor: t.color, borderColor: t.color } : undefined}>
                    #{t.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label={tr("Observações", "Notes")}>
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder={tr("Opcional", "Optional")} />
        </Field>
      </form>
    </Modal>
  );
}
