"use client";

import { TxLink } from "@/components/filter-link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Archive, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { api, parseError, type FieldErrors } from "@/lib/api";
import { ACCOUNT_TYPES, cn, money, parseAmount } from "@/lib/format";
import { useAccounts, useInvalidateFinance } from "@/lib/queries";
import type { Account } from "@/lib/types";
import { Badge, Button, Carousel, ColorPicker, ConfirmDialog, cuteHover, EmptyState, Field, Input, Modal, MoneyInput, PageHeader, Progress, Select, Skeleton, Toggle } from "@/components/ui";
import { ACCOUNT_ICONS } from "@/components/icons";

export default function AccountsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useAccounts(showArchived);
  const [editing, setEditing] = useState<Account | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const invalidate = useInvalidateFinance();

  const remove = async () => {
    try {
      await api.delete(`/accounts/${toDelete!.id}`);
      toast.success("Conta excluída");
      invalidate();
    } catch (e) {
      toast.error(parseError(e).message);
    } finally {
      setToDelete(null);
    }
  };

  const accounts = data?.data ?? [];

  return (
    <>
      <PageHeader title="Contas e cartões" description="Bancos, carteira, poupança, investimentos e cartões de crédito"
        actions={<>
          <Toggle checked={showArchived} onChange={setShowArchived} label="Mostrar arquivadas" />
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Nova conta</Button>
        </>} />

      {data && (
        <Carousel className="mb-6 sm:grid-cols-3">
          <Summary label="Saldo atual (contas)" value={data.summary.total_balance} />
          <Summary label="Saldo previsto (com pendentes)" value={data.summary.projected_balance} />
          <Summary label="Fatura/dívida de cartões" value={-data.summary.credit_card_debt} />
        </Carousel>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="Nenhuma conta cadastrada" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const Icon = ACCOUNT_ICONS[a.type] ?? Wallet;
            const isCard = a.type === "credit_card";
            return (
              <div key={a.id} className={cn("group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", cuteHover, a.is_archived && "opacity-60")}>
                <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: a.color }} />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${a.color}1f`, color: a.color }}><Icon className="h-5 w-5" /></span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{a.name}</p>
                      <p className="text-xs text-slate-500">{ACCOUNT_TYPES[a.type]}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                    <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" onClick={() => { setEditing(a); setFormOpen(true); }} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800" onClick={() => setToDelete(a)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-500">{isCard ? "Fatura em aberto" : "Saldo atual"}</p>
                <p className={cn("tabular text-2xl font-bold", a.balance < 0 && !isCard ? "text-rose-600" : "text-slate-900 dark:text-white")}>
                  {money(isCard ? Math.abs(Math.min(0, a.projected_balance)) : a.balance)}
                </p>
                {!isCard && a.projected_balance !== a.balance && <p className="text-xs text-slate-500">Previsto: {money(a.projected_balance)}</p>}

                {isCard && a.credit_limit ? (
                  <div className="mt-3">
                    <Progress value={((a.credit_used ?? 0) / a.credit_limit) * 100} />
                    <div className="mt-1 flex justify-between text-xs text-slate-500">
                      <span>Disponível {money(a.credit_available)}</span>
                      <span>Limite {money(a.credit_limit)}</span>
                    </div>
                    {(a.closing_day || a.due_day) && <p className="mt-1 text-xs text-slate-500">Fecha dia {a.closing_day ?? "—"} · vence dia {a.due_day ?? "—"}</p>}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between">
                  <TxLink filters={{ account_ids: [a.id] }} className="text-xs font-medium text-brand-600 hover:underline">Ver lançamentos</TxLink>
                  <div className="flex gap-1">
                    {!a.include_in_total && <Badge>Fora do total</Badge>}
                    {a.is_archived && <Badge><Archive className="h-3 w-3" />Arquivada</Badge>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AccountForm open={formOpen} onClose={() => setFormOpen(false)} account={editing} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title="Excluir conta" confirmLabel="Excluir"
        message={<>Excluir a conta <strong>{toDelete?.name}</strong>? Contas com lançamentos não podem ser excluídas — nesse caso, arquive-a pela edição.</>} />
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn("tabular mt-1 text-xl font-bold", value < 0 ? "text-rose-600" : "text-slate-900 dark:text-white")}>{money(value)}</p>
    </div>
  );
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type AccountFormProps = { open: boolean; onClose: () => void; account: Account | null };

function AccountForm(props: AccountFormProps) {
  return props.open ? <AccountFormInner key={props.account?.id ?? "new"} {...props} /> : null;
}

function AccountFormInner({ onClose, account }: AccountFormProps) {
  const [form, setForm] = useState(() => account ? {
    name: account.name, type: account.type as string, initial_balance: String(account.initial_balance).replace(".", ","),
    credit_limit: account.credit_limit ? String(account.credit_limit).replace(".", ",") : "", closing_day: account.closing_day?.toString() ?? "",
    due_day: account.due_day?.toString() ?? "", color: account.color, include_in_total: account.include_in_total, is_archived: account.is_archived,
  } : { name: "", type: "checking", initial_balance: "0", credit_limit: "", closing_day: "", due_day: "", color: "#6366f1", include_in_total: true, is_archived: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateFinance();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isCard = form.type === "credit_card";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      initial_balance: parseAmount(form.initial_balance || "0"),
      credit_limit: isCard && form.credit_limit ? parseAmount(form.credit_limit) : null,
      closing_day: isCard && form.closing_day ? Number(form.closing_day) : null,
      due_day: isCard && form.due_day ? Number(form.due_day) : null,
    };
    try {
      if (account) await api.put(`/accounts/${account.id}`, payload);
      else await api.post("/accounts", payload);
      toast.success(account ? "Conta atualizada" : "Conta criada");
      invalidate();
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
    <Modal open onClose={onClose} title={account ? "Editar conta" : "Nova conta"}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="account-form" loading={saving}>Salvar</Button></>}>
      <form id="account-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" error={errors.name} className="sm:col-span-2"><Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Nubank, Carteira" /></Field>
        <Field label="Tipo"><Select value={form.type} onChange={(e) => set("type", e.target.value)}>{Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Saldo inicial" error={errors.initial_balance} hint="Saldo antes do primeiro lançamento"><MoneyInput allowNegative value={form.initial_balance} onChange={(v) => set("initial_balance", v)} /></Field>
        {isCard && (
          <>
            <Field label="Limite" error={errors.credit_limit}><MoneyInput value={form.credit_limit} onChange={(v) => set("credit_limit", v)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Fecha dia"><Select value={form.closing_day} onChange={(e) => set("closing_day", e.target.value)} placeholder="Dia"><option value="">—</option>{DAYS.map((d) => <option key={d} value={d}>Dia {d}</option>)}</Select></Field>
              <Field label="Vence dia"><Select value={form.due_day} onChange={(e) => set("due_day", e.target.value)} placeholder="Dia"><option value="">—</option>{DAYS.map((d) => <option key={d} value={d}>Dia {d}</option>)}</Select></Field>
            </div>
          </>
        )}
        <Field label="Cor" group className="sm:col-span-2"><ColorPicker value={form.color} onChange={(c) => set("color", c)} /></Field>
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <Toggle checked={form.include_in_total} onChange={(v) => set("include_in_total", v)} label="Incluir no saldo total" />
          {account && <Toggle checked={form.is_archived} onChange={(v) => set("is_archived", v)} label="Arquivada" />}
        </div>
      </form>
    </Modal>
  );
}
