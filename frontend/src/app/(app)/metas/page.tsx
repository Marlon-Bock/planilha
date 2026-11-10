"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CircleCheck, Link2, ListChecks, Minus, Pencil, PiggyBank, Plus, Target, Trash2, Undo2, Users } from "lucide-react";
import { api, parseError, type FieldErrors } from "@/lib/api";
import { cn, fmtDate, money, parseAmount, percent, today } from "@/lib/format";
import { useInvalidateFinance } from "@/lib/queries";
import type { Goal, Investment } from "@/lib/types";
import { burstFrom, heartRain } from "@/components/cute";
import { Badge, Button, Carousel, ColorPicker, ConfirmDialog, cuteHover, DatePicker, EmptyState, Field, Input, Modal, MoneyInput, MultiSelect, PageHeader, Progress, Skeleton, Textarea } from "@/components/ui";
import { MovementForm, type MovementState } from "@/components/investment-movement-form";
import { tr } from "@/lib/i18n";
import { useSharing } from "@/components/sharing";

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
  // Meta de casal: escolher quais das minhas caixinhas guardam para ela.
  const [linking, setLinking] = useState<Goal | null>(null);
  const invalidate = useInvalidateFinance();
  const { data: investments = [] } = useQuery({
    queryKey: ["investments", { showInactive: false }],
    queryFn: async () => (await api.get<{ data: Investment[] }>("/investments")).data,
    select: (r) => r.data,
  });

  const openInvest = (g: Goal, kind: "deposit" | "withdraw") => {
    const ids = new Set(g.linked_investments?.filter((i) => i.mine).map((i) => i.id));
    const options = investments.filter((i) => ids.has(i.id));
    if (!options.length) return toast.error(tr("Não encontramos as caixinhas desta meta. Recarregue a página.", "We couldn't find this goal's investments. Reload the page."));
    setInvesting({ state: { inv: options.length === 1 ? options[0] : null, kind }, options });
  };

  const toggleDone = async (g: Goal, e: React.MouseEvent) => {
    const button = e.currentTarget;
    try {
      const { data } = await api.post<{ data: Goal }>(`/goals/${g.id}/toggle`);
      if (data.data.completed_at) {
        burstFrom(button, 16);
        toast.success(tr(`"${g.name}" feita! 🎉`, `"${g.name}" done! 🎉`));
      }
      invalidate();
    } catch (err) { toast.error(parseError(err).message); }
  };

  const remove = async () => {
    await api.delete(`/goals/${toDelete!.id}`);
    toast.success(tr("Meta excluída", "Goal deleted"));
    setToDelete(null);
    invalidate();
  };

  return (
    <>
      <PageHeader title={tr("Metas", "Goals")} description={tr("Junte dinheiro, combine coisas para fazer e compartilhe metas a dois", "Save money, plan things to do and share goals as a couple")}
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> {tr("Nova meta", "New goal")}</Button>} />

      {data && data.data.length > 0 && (
        <Carousel className="mb-6 sm:grid-cols-3">
          <Stat label={tr("Total guardado", "Total saved")} value={money(data.summary.saved)} />
          <Stat label={tr("Soma dos objetivos", "Sum of targets")} value={money(data.summary.target)} />
          <Stat label={tr("Metas concluídas", "Goals completed")} value={tr(`${data.summary.completed} de ${data.data.length}`, `${data.summary.completed} of ${data.data.length}`)} />
        </Carousel>
      )}

      {isLoading ? <Skeleton className="h-64" /> : !data?.data.length ? (
        <EmptyState icon={<Target className="h-6 w-6" />} title={tr("Nenhuma meta ainda", "No goals yet")} description={tr("Reserva de emergência, viagem, carro novo... ou algo para fazer juntos. Crie uma meta e acompanhe.", "Emergency fund, trip, new car... or something to do together. Create a goal and track it.")}
          action={<Button onClick={() => setFormOpen(true)}>{tr("Criar meta", "Create goal")}</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((g) => {
            const shared = !g.is_owner || !!g.members?.length;
            const hasMine = !!g.linked_investments?.some((i) => i.mine);
            const anyLinked = !!g.linked_investments?.length;
            return (
            <div key={g.id} className={cn("group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", cuteHover)}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${g.color}1f`, color: g.color }}>{g.kind === "task" ? <ListChecks className="h-5 w-5 cute:group-hover:animate-wiggle" /> : <Target className="h-5 w-5 cute:group-hover:animate-wiggle" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{g.name}</p>
                  <p className="text-xs text-slate-500">{g.deadline ? tr(`Prazo: ${fmtDate(g.deadline)}`, `Deadline: ${fmtDate(g.deadline)}`) : tr("Sem prazo", "No deadline")}</p>
                </div>
                {g.completed_at && <Badge tone="green"><CircleCheck className="h-3 w-3" />{g.kind === "task" ? tr("Feita", "Done") : tr("Concluída", "Completed")}</Badge>}
              </div>
              {(!g.is_owner || !!g.members?.length) && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-300">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {g.is_owner
                      ? tr(`Com ${g.members!.map((m) => m.name).join(", ")}`, `With ${g.members!.map((m) => m.name).join(", ")}`)
                      : tr(`Meta de ${g.user?.name ?? "outra pessoa"}, com você`, `${g.user?.name ?? "Someone"}'s goal, with you`)}
                  </span>
                </p>
              )}
              {g.kind !== "task" && (
              <>
              <div className="mt-4 flex items-end justify-between">
                <p className="tabular text-xl font-bold text-slate-900 dark:text-white">{money(g.current_amount)}</p>
                <p className="text-sm text-slate-500">{tr("de", "of")} {money(g.target_amount)}</p>
              </div>
              <Progress value={g.progress} color={g.color} className="mt-2 h-2.5" heart />
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>{percent(g.progress, 0)}</span>
                {g.monthly_needed && <span>{tr(`Guarde ${money(g.monthly_needed)}/mês`, `Save ${money(g.monthly_needed)}/month`)}</span>}
              </div>
              </>
              )}
              {!!g.linked_investments?.length && (
                <div className="mt-3 rounded-xl bg-violet-50/70 p-2.5 dark:bg-violet-500/10">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                    <Link2 className="h-3.5 w-3.5" /> {g.linked_investments.length > 1 ? tr(`Guardado em ${g.linked_investments.length} caixinhas`, `Saved in ${g.linked_investments.length} investments`) : tr("Guardado em caixinha", "Saved in an investment")}
                  </p>
                  <ul className="space-y-1">
                    {g.linked_investments.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />
                          <span className="truncate">{i.name}{!shared && i.institution && <span className="text-slate-400"> · {i.institution}</span>}{shared && i.owner && <span className="text-violet-600 dark:text-violet-300"> · {i.mine ? tr("minha", "mine") : i.owner.trim().split(/\s+/)[0]}</span>}</span>
                        </span>
                        <span className="tabular font-medium text-slate-800 dark:text-slate-100">{money(i.balance)}{i.is_estimated && <span className="font-normal text-slate-400"> (est.)</span>}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {g.notes && <p className="mt-3 text-xs text-slate-500">{g.notes}</p>}
              <div className="mt-auto flex items-center gap-2 pt-4">
                {g.kind === "task" ? (
                  <Button size="sm" className="flex-1" variant={g.completed_at ? "outline" : "primary"} onClick={(e) => toggleDone(g, e)}>
                    {g.completed_at ? <><Undo2 className="h-4 w-4" /> {tr("Desfazer", "Undo")}</> : <><Check className="h-4 w-4" /> {tr("Marcar como feita", "Mark as done")}</>}
                  </Button>
                ) : !hasMine && (anyLinked || !g.is_owner) ? (
                  // A meta soma caixinhas (ou é de outra pessoa) e eu ainda não liguei nenhuma minha.
                  <Button size="sm" className="flex-1" variant="outline" onClick={() => setLinking(g)}><Link2 className="h-4 w-4" /> {tr("Adicionar minha caixinha", "Add my investment")}</Button>
                ) : hasMine ? (
                  <>
                    <Button size="sm" className="flex-1" onClick={() => openInvest(g, "deposit")}><Plus className="h-4 w-4" /> {tr("Aplicar", "Deposit")}</Button>
                    <Button size="sm" variant="outline" onClick={() => openInvest(g, "withdraw")} title={tr("Resgatar da caixinha", "Withdraw from investment")}><Minus className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" className="flex-1" onClick={() => setMoving({ goal: g, withdraw: false })}><Plus className="h-4 w-4" /> {tr("Depositar", "Deposit")}</Button>
                    <Button size="sm" variant="outline" onClick={() => setMoving({ goal: g, withdraw: true })} title={tr("Retirar", "Withdraw")}><Minus className="h-4 w-4" /></Button>
                  </>
                )}
                {!g.is_owner && hasMine && (
                  <Button size="sm" variant="ghost" onClick={() => setLinking(g)} title={tr("Minhas caixinhas nesta meta", "My investments in this goal")}><Link2 className="h-4 w-4" /></Button>
                )}
                {g.is_owner && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(g); setFormOpen(true); }} title={tr("Editar", "Edit")}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(g)} title={tr("Excluir", "Delete")}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
              {!!g.contributions?.length && (
                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer select-none">{tr("Histórico", "History")} ({g.contributions.length})</summary>
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
            );
          })}
        </div>
      )}

      <GoalForm open={formOpen} onClose={() => setFormOpen(false)} goal={editing} investments={investments} />
      <ContributionForm state={moving} onClose={() => setMoving(null)} />
      {linking && <LinkMineModal key={linking.id} goal={linking} investments={investments} onClose={() => setLinking(null)} />}
      <MovementForm state={investing?.state ?? null} investments={investing?.options ?? []} onClose={() => setInvesting(null)} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title={tr("Excluir meta", "Delete goal")} confirmLabel={tr("Excluir", "Delete")}
        message={<>{tr("Excluir a meta ", "Delete the goal ")}<strong>{toDelete?.name}</strong>{tr(" e seu histórico?", " and its history?")}</>} />
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
    deadline: goal.deadline ?? "", color: goal.color, notes: goal.notes ?? "", kind: goal.kind,
  } : { name: "", target_amount: "", current_amount: "", deadline: "", color: "#10b981", notes: "", kind: "money" as Goal["kind"] });
  const [memberIds, setMemberIds] = useState<number[]>(() => goal?.members?.map((m) => m.id) ?? []);
  const { data: sharing } = useSharing();
  const people = sharing?.users ?? [];
  const task = form.kind === "task";
  const [investmentIds, setInvestmentIds] = useState<number[]>(() => goal?.linked_investments?.map((i) => i.id) ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateFinance();
  const linked = !task && (investmentIds.length > 0 || (goal?.linked_investments ?? []).some((i) => !i.mine));
  // Caixinhas livres ou já desta meta (uma caixinha guarda para uma meta só).
  const options = investments
    .filter((i) => !i.goal_id || i.goal_id === goal?.id)
    .map((i) => ({ id: i.id, name: `${i.name}${i.institution ? ` · ${i.institution}` : ""} (${money(i.balance)})`, color: i.color }));
  // Caixinhas que os participantes ligaram (não aparecem na minha lista, mas entram na soma).
  const othersTotal = task ? 0 : (goal?.linked_investments ?? []).filter((i) => !i.mine).reduce((t, i) => t + i.balance, 0);
  const linkedTotal = investments.filter((i) => investmentIds.includes(i.id)).reduce((t, i) => t + i.balance, 0) + othersTotal;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      target_amount: task ? null : parseAmount(form.target_amount),
      current_amount: task || linked ? undefined : form.current_amount ? parseAmount(form.current_amount) : 0,
      deadline: form.deadline || null,
      notes: form.notes || null,
      investment_ids: task ? [] : investmentIds,
      member_ids: memberIds,
    };
    try {
      if (goal) await api.put(`/goals/${goal.id}`, payload);
      else await api.post("/goals", payload);
      toast.success(tr("Meta salva", "Goal saved"));
      invalidate();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={goal ? tr("Editar meta", "Edit goal") : tr("Nova meta", "New goal")}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancelar", "Cancel")}</Button><Button type="submit" form="goal-form" loading={saving}>{tr("Salvar", "Save")}</Button></>}>
      <form id="goal-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {!goal && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:col-span-2 dark:bg-slate-800">
            {([["money", tr("Juntar dinheiro", "Save money"), PiggyBank], ["task", tr("Fazer algo", "Do something"), ListChecks]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })}
                className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition", form.kind === k ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700")}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        )}
        <Field label={task ? tr("O que vocês querem fazer?", "What do you want to do?") : tr("Nome", "Name")} error={errors.name} className="sm:col-span-2"
          hint={task ? tr("Sem valor: quando fizerem, é só marcar como feita.", "No amount: when it's done, just mark it.") : undefined}>
          <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={task ? tr("Ex.: Viajar para a praia, fazer academia juntos", "E.g. Go to the beach, work out together") : tr("Ex.: Reserva de emergência", "E.g. Emergency fund")} />
        </Field>
        {!task && (
        <>
        <Field label={tr("Valor objetivo", "Target amount")} error={errors.target_amount}><MoneyInput value={form.target_amount} onChange={(v) => setForm({ ...form, target_amount: v })} /></Field>
        {linked ? (
          <Field label={tr("Já guardado", "Already saved")} hint={othersTotal > 0 ? tr(`Soma das caixinhas vinculadas (${money(othersTotal)} de quem participa)`, `Sum of linked investments (${money(othersTotal)} from participants)`) : tr("Vem do saldo das caixinhas vinculadas", "Comes from the linked investments' balance")}>
            <div className="tabular flex h-10 items-center rounded-lg border border-dashed border-violet-300 bg-violet-50/60 px-3 text-sm font-medium text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
              {money(linkedTotal)}
            </div>
          </Field>
        ) : (
          <Field label={tr("Já guardado", "Already saved")}><MoneyInput value={form.current_amount} onChange={(v) => setForm({ ...form, current_amount: v })} /></Field>
        )}
        <Field label={tr("Caixinhas desta meta", "Investments for this goal")} group className="sm:col-span-2"
          hint={options.length ? tr("Opcional. Com caixinhas vinculadas, o progresso acompanha o saldo delas (com rendimento).", "Optional. With linked investments, progress follows their balance (including yield).") : tr("Cadastre caixinhas em Investimentos para vincular aqui.", "Add investments in Investments to link them here.")}>
          <MultiSelect label={linked ? tr("Caixinhas vinculadas", "Linked investments") : tr("Vincular caixinhas (opcional)", "Link investments (optional)")} options={options} value={investmentIds} onChange={setInvestmentIds} />
        </Field>
        </>
        )}
        {people.length > 0 && (
          <Field label={tr("Meta de casal: quem participa", "Couple goal: who takes part")} group className="sm:col-span-2" error={errors["member_ids.0"]}
            hint={task ? tr("Quem participa vê a meta e também pode marcar como feita.", "Participants see the goal and can also mark it as done.") : tr("Quem participa vê a meta e pode ligar as próprias caixinhas: o guardado é a soma das de todos.", "Participants see the goal and can link their own investments: the saved amount is everyone's sum.")}>
            <MultiSelect label={memberIds.length ? tr("Participantes", "Participants") : tr("Só eu (toque para convidar)", "Just me (tap to invite)")} options={people} value={memberIds} onChange={setMemberIds} />
          </Field>
        )}
        <Field label={tr("Prazo (opcional)", "Deadline (optional)")} className="sm:col-span-2"><DatePicker clearable placeholder={tr("Sem prazo", "No deadline")} value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} /></Field>
        <Field label={tr("Cor", "Color")} group className="sm:col-span-2"><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} /></Field>
        <Field label={tr("Observações", "Notes")} className="sm:col-span-2"><Textarea placeholder={tr("Opcional: motivação, onde o dinheiro está guardado...", "Optional: motivation, where the money is kept...")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></Field>
      </form>
    </Modal>
  );
}

/** Meta de casal: quais das minhas caixinhas guardam dinheiro para ela. */
function LinkMineModal({ goal, investments, onClose }: { goal: Goal; investments: Investment[]; onClose: () => void }) {
  const [ids, setIds] = useState<number[]>(() => goal.linked_investments?.filter((i) => i.mine).map((i) => i.id) ?? []);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateFinance();
  // Caixinhas livres ou já desta meta (uma caixinha guarda para uma meta só).
  const options = investments
    .filter((i) => !i.goal_id || i.goal_id === goal.id)
    .map((i) => ({ id: i.id, name: `${i.name}${i.institution ? ` · ${i.institution}` : ""} (${money(i.balance)})`, color: i.color }));
  const others = (goal.linked_investments ?? []).filter((i) => !i.mine).reduce((t, i) => t + i.balance, 0);
  const mine = investments.filter((i) => ids.includes(i.id)).reduce((t, i) => t + i.balance, 0);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/goals/${goal.id}/investments`, { investment_ids: ids });
      toast.success(ids.length ? tr("Sua caixinha agora soma nesta meta 💕", "Your investment now counts toward this goal 💕") : tr("Suas caixinhas saíram desta meta", "Your investments were removed from this goal"));
      invalidate();
      onClose();
    } catch (err) { toast.error(parseError(err).message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={tr(`Minhas caixinhas em "${goal.name}"`, `My investments in "${goal.name}"`)} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancelar", "Cancel")}</Button><Button loading={saving} onClick={save}>{tr("Salvar", "Save")}</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {tr("Escolha quais das suas caixinhas guardam dinheiro para esta meta. O saldo delas soma com o de quem mais participa.", "Choose which of your investments save money for this goal. Their balance is added to the other participants'.")}
        </p>
        {options.length ? (
          <MultiSelect label={ids.length ? tr("Minhas caixinhas", "My investments") : tr("Escolher caixinhas", "Choose investments")} options={options} value={ids} onChange={setIds} />
        ) : (
          <p className="text-sm text-slate-400">{tr("Você não tem caixinhas livres. Cadastre uma em Investimentos.", "You have no free investments. Add one in Investments.")}</p>
        )}
        <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <p className="flex justify-between"><span>{tr("Minhas caixinhas", "My investments")}</span><strong className="tabular">{money(mine)}</strong></p>
          <p className="flex justify-between"><span>{tr("De quem participa", "From other participants")}</span><strong className="tabular">{money(others)}</strong></p>
          <p className="flex justify-between border-t border-slate-200 pt-1 dark:border-slate-700"><span>{tr("Total guardado", "Total saved")}</span><strong className="tabular">{money(mine + others)} {tr("de", "of")} {money(goal.target_amount)}</strong></p>
        </div>
      </div>
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
        toast.success(tr(`Meta "${state.goal.name}" concluída! Parabéns, vocês conseguiram 🎉💕`, `Goal "${state.goal.name}" reached! Congrats, you did it 🎉💕`));
      } else {
        if (!state.withdraw) burstFrom(document.getElementById("contrib-form"), 14);
        toast.success(state.withdraw ? tr("Retirada registrada", "Withdrawal recorded") : tr("Depósito registrado 💕", "Deposit recorded 💕"));
      }
      invalidate();
      onClose();
    } catch (err) { toast.error(parseError(err).message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`${state.withdraw ? tr("Retirar de", "Withdraw from") : tr("Depositar em", "Deposit to")} ${state.goal.name}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancelar", "Cancel")}</Button><Button type="submit" form="contrib-form" loading={saving} variant={state.withdraw ? "danger" : "primary"}>{tr("Confirmar", "Confirm")}</Button></>}>
      <form id="contrib-form" onSubmit={submit} className="space-y-4">
        <Field label={tr("Valor", "Amount")}><MoneyInput autoFocus value={amount} onChange={(v) => setAmount(v)} required /></Field>
        <Field label={tr("Data", "Date")}><DatePicker value={date} onChange={(v) => setDate(v)} /></Field>
        <Field label={tr("Observação", "Note")}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Opcional", "Optional")} /></Field>
      </form>
    </Modal>
  );
}
