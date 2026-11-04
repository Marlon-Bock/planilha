"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleCheck, Link2, Minus, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { api, parseError, type FieldErrors } from "@/lib/api";
import { cn, fmtDate, money, parseAmount, percent, today } from "@/lib/format";
import { useInvalidateFinance } from "@/lib/queries";
import type { Goal, Investment } from "@/lib/types";
import { burstFrom, heartRain } from "@/components/cute";
import { Badge, Button, ColorPicker, ConfirmDialog, cuteHover, DatePicker, EmptyState, Field, Input, Modal, MoneyInput, MultiSelect, PageHeader, Progress, Skeleton, Textarea } from "@/components/ui";
import { MovementForm, type MovementState } from "@/components/investment-movement-form";

export default function GoalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => (await api.get<{ data: Goal[]; summary: { target: number; saved: number; completed: number } }>("/goals")).data,
  });
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [moving, setMoving] = useState<{ goal: Goal; withdraw: boolean } | null>(null);
  // Metas ligadas a caixinhas: aplicar/resgatar abre o formulário de investimentos.
  const [investing, setInvesting] = useState<{ state: MovementState; options: Investment[] } | null>(null);
  const [toDelete, setToDelete] = useState<Goal | null>(null);
  const invalidate = useInvalidateFinance();
  const { data: investments = [] } = useQuery({
    queryKey: ["investments", { showInactive: false }],
    queryFn: async () => (await api.get<{ data: Investment[] }>("/investments")).data,
    select: (r) => r.data,
  });

  const openInvest = (g: Goal, kind: "deposit" | "withdraw") => {
    const ids = new Set(g.linked_investments?.map((i) => i.id));
    const options = investments.filter((i) => ids.has(i.id));
    if (!options.length) return toast.error("Não encontramos as caixinhas desta meta. Recarregue a página.");
    setInvesting({ state: { inv: options.length === 1 ? options[0] : null, kind }, options });
  };

  const remove = async () => {
    await api.delete(`/goals/${toDelete!.id}`);
    toast.success("Meta excluída");
    setToDelete(null);
    invalidate();
  };

  return (
    <>
      <PageHeader title="Metas" description="Junte dinheiro para seus objetivos"
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Nova meta</Button>} />

      {data && data.data.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Total guardado" value={money(data.summary.saved)} />
          <Stat label="Soma dos objetivos" value={money(data.summary.target)} />
          <Stat label="Metas concluídas" value={`${data.summary.completed} de ${data.data.length}`} />
        </div>
      )}

      {isLoading ? <Skeleton className="h-64" /> : !data?.data.length ? (
        <EmptyState icon={<Target className="h-6 w-6" />} title="Nenhuma meta ainda" description="Reserva de emergência, viagem, carro novo... crie uma meta e acompanhe o progresso."
          action={<Button onClick={() => setFormOpen(true)}>Criar meta</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((g) => (
            <div key={g.id} className={cn("group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", cuteHover)}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${g.color}1f`, color: g.color }}><Target className="h-5 w-5 cute:group-hover:animate-wiggle" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{g.name}</p>
                  <p className="text-xs text-slate-500">{g.deadline ? `Prazo: ${fmtDate(g.deadline)}` : "Sem prazo"}</p>
                </div>
                {g.completed_at && <Badge tone="green"><CircleCheck className="h-3 w-3" />Concluída</Badge>}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <p className="tabular text-xl font-bold text-slate-900 dark:text-white">{money(g.current_amount)}</p>
                <p className="text-sm text-slate-500">de {money(g.target_amount)}</p>
              </div>
              <Progress value={g.progress} color={g.color} className="mt-2 h-2.5" heart />
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>{percent(g.progress, 0)}</span>
                {g.monthly_needed && <span>Guarde {money(g.monthly_needed)}/mês</span>}
              </div>
              {!!g.linked_investments?.length && (
                <div className="mt-3 rounded-xl bg-violet-50/70 p-2.5 dark:bg-violet-500/10">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                    <Link2 className="h-3.5 w-3.5" /> Guardado em {g.linked_investments.length > 1 ? `${g.linked_investments.length} caixinhas` : "caixinha"}
                  </p>
                  <ul className="space-y-1">
                    {g.linked_investments.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />
                          <span className="truncate">{i.name}{i.institution && <span className="text-slate-400"> · {i.institution}</span>}</span>
                        </span>
                        <span className="tabular font-medium text-slate-800 dark:text-slate-100">{money(i.balance)}{i.is_estimated && <span className="font-normal text-slate-400"> (est.)</span>}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {g.notes && <p className="mt-3 text-xs text-slate-500">{g.notes}</p>}
              <div className="mt-auto flex gap-2 pt-4">
                {g.linked_investments?.length ? (
                  <>
                    <Button size="sm" className="flex-1" onClick={() => openInvest(g, "deposit")}><Plus className="h-4 w-4" /> Aplicar na caixinha</Button>
                    <Button size="sm" variant="outline" onClick={() => openInvest(g, "withdraw")} title="Resgatar da caixinha"><Minus className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" className="flex-1" onClick={() => setMoving({ goal: g, withdraw: false })}><Plus className="h-4 w-4" /> Depositar</Button>
                    <Button size="sm" variant="outline" onClick={() => setMoving({ goal: g, withdraw: true })} title="Retirar"><Minus className="h-4 w-4" /></Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setEditing(g); setFormOpen(true); }} title="Editar"><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setToDelete(g)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
              </div>
              {!!g.contributions?.length && (
                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer select-none">Histórico ({g.contributions.length})</summary>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {g.contributions.map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span>{fmtDate(c.date)} {c.note && `· ${c.note}`}</span>
                        <span className={c.amount < 0 ? "text-rose-600" : "text-teal-600"}>{money(c.amount, { sign: true })}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <GoalForm open={formOpen} onClose={() => setFormOpen(false)} goal={editing} investments={investments} />
      <ContributionForm state={moving} onClose={() => setMoving(null)} />
      <MovementForm state={investing?.state ?? null} investments={investing?.options ?? []} onClose={() => setInvesting(null)} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title="Excluir meta" confirmLabel="Excluir"
        message={<>Excluir a meta <strong>{toDelete?.name}</strong> e seu histórico?</>} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="tabular mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

type GoalFormProps = { open: boolean; onClose: () => void; goal: Goal | null; investments: Investment[] };

function GoalForm(props: GoalFormProps) {
  return props.open ? <GoalFormInner key={props.goal?.id ?? "new"} {...props} /> : null;
}

function GoalFormInner({ onClose, goal, investments }: GoalFormProps) {
  const [form, setForm] = useState(() => goal ? {
    name: goal.name, target_amount: String(goal.target_amount).replace(".", ","), current_amount: String(goal.current_amount).replace(".", ","),
    deadline: goal.deadline ?? "", color: goal.color, notes: goal.notes ?? "",
  } : { name: "", target_amount: "", current_amount: "", deadline: "", color: "#10b981", notes: "" });
  const [investmentIds, setInvestmentIds] = useState<number[]>(() => goal?.linked_investments?.map((i) => i.id) ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateFinance();
  const linked = investmentIds.length > 0;
  // Caixinhas livres ou já desta meta (uma caixinha guarda para uma meta só).
  const options = investments
    .filter((i) => !i.goal_id || i.goal_id === goal?.id)
    .map((i) => ({ id: i.id, name: `${i.name}${i.institution ? ` · ${i.institution}` : ""} (${money(i.balance)})`, color: i.color }));
  const linkedTotal = investments.filter((i) => investmentIds.includes(i.id)).reduce((t, i) => t + i.balance, 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      target_amount: parseAmount(form.target_amount),
      current_amount: linked ? undefined : form.current_amount ? parseAmount(form.current_amount) : 0,
      deadline: form.deadline || null,
      notes: form.notes || null,
      investment_ids: investmentIds,
    };
    try {
      if (goal) await api.put(`/goals/${goal.id}`, payload);
      else await api.post("/goals", payload);
      toast.success("Meta salva");
      invalidate();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={goal ? "Editar meta" : "Nova meta"}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="goal-form" loading={saving}>Salvar</Button></>}>
      <form id="goal-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" error={errors.name} className="sm:col-span-2"><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Reserva de emergência" /></Field>
        <Field label="Valor objetivo" error={errors.target_amount}><MoneyInput value={form.target_amount} onChange={(v) => setForm({ ...form, target_amount: v })} /></Field>
        {linked ? (
          <Field label="Já guardado" hint="Vem do saldo das caixinhas vinculadas">
            <div className="tabular flex h-10 items-center rounded-lg border border-dashed border-violet-300 bg-violet-50/60 px-3 text-sm font-medium text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
              {money(linkedTotal)}
            </div>
          </Field>
        ) : (
          <Field label="Já guardado"><MoneyInput value={form.current_amount} onChange={(v) => setForm({ ...form, current_amount: v })} /></Field>
        )}
        <Field label="Caixinhas desta meta" group className="sm:col-span-2"
          hint={options.length ? "Opcional. Com caixinhas vinculadas, o progresso acompanha o saldo delas (com rendimento)." : "Cadastre caixinhas em Investimentos para vincular aqui."}>
          <MultiSelect label={linked ? "Caixinhas vinculadas" : "Vincular caixinhas (opcional)"} options={options} value={investmentIds} onChange={setInvestmentIds} />
        </Field>
        <Field label="Prazo (opcional)" className="sm:col-span-2"><DatePicker clearable placeholder="Sem prazo" value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} /></Field>
        <Field label="Cor" group className="sm:col-span-2"><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} /></Field>
        <Field label="Observações" className="sm:col-span-2"><Textarea placeholder="Opcional: motivação, onde o dinheiro está guardado..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></Field>
      </form>
    </Modal>
  );
}

type ContributionProps = { state: { goal: Goal; withdraw: boolean } | null; onClose: () => void };

function ContributionForm({ state, onClose }: ContributionProps) {
  return state ? <ContributionFormInner key={`${state.goal.id}-${state.withdraw}`} state={state} onClose={onClose} /> : null;
}

function ContributionFormInner({ state, onClose }: { state: { goal: Goal; withdraw: boolean }; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateFinance();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const v = parseAmount(amount);
      const { data } = await api.post<{ data: Goal }>(`/goals/${state.goal.id}/contribute`, { amount: state.withdraw ? -v : v, date, note: note || null });
      const justCompleted = !state.goal.completed_at && !!data.data.completed_at;
      if (justCompleted) {
        heartRain(50); // comemoração: chuva de corações
        toast.success(`Meta "${state.goal.name}" concluída! Parabéns, vocês conseguiram 🎉💕`);
      } else {
        if (!state.withdraw) burstFrom(document.getElementById("contrib-form"), 14);
        toast.success(state.withdraw ? "Retirada registrada" : "Depósito registrado 💕");
      }
      invalidate();
      onClose();
    } catch (err) { toast.error(parseError(err).message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`${state.withdraw ? "Retirar de" : "Depositar em"} ${state.goal.name}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="contrib-form" loading={saving} variant={state.withdraw ? "danger" : "primary"}>Confirmar</Button></>}>
      <form id="contrib-form" onSubmit={submit} className="space-y-4">
        <Field label="Valor"><MoneyInput autoFocus value={amount} onChange={(v) => setAmount(v)} required /></Field>
        <Field label="Data"><DatePicker value={date} onChange={(v) => setDate(v)} /></Field>
        <Field label="Observação"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></Field>
      </form>
    </Modal>
  );
}
