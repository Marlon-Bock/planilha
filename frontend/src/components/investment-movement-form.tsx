"use client";

/**
 * Formulário de aplicação / resgate / atualização de saldo de investimentos.
 * Usado na tela de Investimentos e nas Metas ligadas a caixinhas.
 */

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, parseError } from "@/lib/api";
import { cn, money, parseAmount, percent, rateLabel, today } from "@/lib/format";
import { useAccounts, useInvalidateFinance } from "@/lib/queries";
import type { Investment } from "@/lib/types";
import { Button, DatePicker, Field, Input, Modal, MoneyInput, Select } from "@/components/ui";
import { burstFrom, heartRain } from "@/components/cute";

export type MovementKind = "deposit" | "withdraw" | "balance";

const MOVE_TEXT: Record<MovementKind, { title: string; button: string; hint: string }> = {
  deposit: { title: "Aplicar em", button: "Aplicar", hint: "Quanto vocês colocaram" },
  withdraw: { title: "Resgatar de", button: "Resgatar", hint: "Quanto vocês tiraram" },
  balance: { title: "Atualizar saldo de", button: "Atualizar", hint: "Copie o saldo que aparece no app do banco" },
};

export type MovementState = { inv: Investment | null; kind: MovementKind };
type MovementProps = { state: MovementState | null; investments: Investment[]; onClose: () => void };

export function MovementForm({ state, investments, onClose }: MovementProps) {
  return state ? <MovementFormInner key={`${state.inv?.id ?? "any"}-${state.kind}`} state={state} investments={investments} onClose={onClose} /> : null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function MovementFormInner({ state, investments, onClose }: { state: MovementState; investments: Investment[]; onClose: () => void }) {
  const chooseInvestment = state.inv === null; // aberto por "Registrar aplicação"
  const [investmentId, setInvestmentId] = useState(() => String(state.inv?.id ?? investments[0]?.id ?? ""));
  const [kind, setKind] = useState<MovementKind>(state.kind);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [accountChoice, setAccountChoice] = useState<string | null>(null); // null = usar a sugestão
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const invalidate = useInvalidateFinance();
  const { data: accountsData } = useAccounts();

  const inv = investments.find((i) => String(i.id) === investmentId) ?? state.inv;
  const accounts = (accountsData?.data ?? []).filter((a) => a.type !== "credit_card");
  // Sugestão: a conta com o mesmo nome da instituição (ex.: investimento "Nubank" → conta "Nubank").
  const suggested = inv?.institution ? accounts.find((a) => norm(a.name).includes(norm(inv.institution!))) : undefined;
  const accountId = accountChoice ?? (suggested ? String(suggested.id) : "");
  const account = accounts.find((a) => String(a.id) === accountId);
  const t = MOVE_TEXT[kind];
  const value = amount ? parseAmount(amount) : 0;
  const moneyMoves = kind !== "balance";

  // Investimentos agrupados por instituição para o seletor.
  const byInstitution = investments.reduce<Record<string, Investment[]>>((acc, i) => {
    (acc[i.institution || "Outros"] ??= []).push(i);
    return acc;
  }, {});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inv) return;
    setSaving(true);
    setError(undefined);
    try {
      const { data } = await api.post<{ goal_completed: string | null }>(`/investments/${inv.id}/movements`, {
        type: kind, amount: value, date, note: note || null,
        account_id: moneyMoves && accountId ? Number(accountId) : null,
      });
      if (data.goal_completed) {
        // A aplicação completou a meta ligada a esta caixinha: comemoração!
        heartRain(50);
        toast.success(`Meta "${data.goal_completed}" concluída! Vocês conseguiram 🎉💕`);
      } else {
        if (kind === "deposit") burstFrom(document.getElementById("move-form"), 14);
        toast.success(
          kind === "deposit" ? `Aplicação de ${money(value)} em ${inv.name} registrada 💕${account ? ` (saiu de ${account.name})` : ""}`
            : kind === "withdraw" ? `Resgate de ${money(value)} registrado${account ? ` (voltou para ${account.name})` : ""}`
              : "Saldo atualizado",
        );
      }
      invalidate();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setError(fields.amount ?? fields.date ?? fields.account_id ?? message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={chooseInvestment ? "Registrar movimentação" : `${t.title} ${inv?.name ?? ""}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="move-form" loading={saving} disabled={!inv} variant={kind === "withdraw" ? "danger" : "primary"}>{t.button}</Button></>}>
      <form id="move-form" onSubmit={submit} className="space-y-4">
        {chooseInvestment && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {([["deposit", "Aplicar"], ["withdraw", "Resgatar"], ["balance", "Atualizar saldo"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={cn("rounded-lg py-2 text-sm font-medium transition",
                  kind === k ? (k === "withdraw" ? "bg-rose-600 text-white" : k === "deposit" ? "bg-brand-600 text-white" : "bg-violet-600 text-white") : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700")}>
                {label}
              </button>
            ))}
          </div>
        )}

        {chooseInvestment && (
          <Field label={kind === "withdraw" ? "De qual investimento?" : kind === "deposit" ? "Em qual investimento?" : "Qual investimento?"}>
            <Select value={investmentId} onChange={(e) => { setInvestmentId(e.target.value); setAccountChoice(null); }}>
              {Object.entries(byInstitution).map(([inst, items]) => (
                <optgroup key={inst} label={inst}>
                  {items.map((i) => <option key={i.id} value={i.id} data-color={i.color}>{i.name} · {rateLabel(i.rate_type, i.rate)}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={kind === "balance" ? "Saldo atual no app" : "Valor"} hint={t.hint} error={error}>
            <MoneyInput autoFocus value={amount} onChange={(v) => setAmount(v)} required />
          </Field>
          <Field label="Data"><DatePicker value={date} onChange={setDate} /></Field>
        </div>

        {moneyMoves && (
          <Field label={kind === "deposit" ? "De qual conta saiu o dinheiro?" : "Para qual conta o dinheiro voltou?"}
            hint={suggested && accountChoice === null ? `Sugestão pela instituição (${inv?.institution})` : "Escolha uma conta para o saldo dela ficar certo"}>
            <Select value={accountId} onChange={(e) => setAccountChoice(e.target.value)}>
              <option value="">Nenhuma: só registrar no investimento</option>
              {accounts.map((a) => <option key={a.id} value={a.id} data-color={a.color}>{a.name} · {money(a.balance)}</option>)}
            </Select>
          </Field>
        )}

        <Field label="Observação"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional: ex. parte do salário, 13º..." /></Field>

        {inv && (
          <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {kind === "balance" ? (
              value > 0 ? (
                <p>Rendimento total passa a ser <strong className={value - inv.invested >= 0 ? "text-teal-600 dark:text-teal-400" : "text-rose-600"}>{money(value - inv.invested, { sign: true })}</strong>
                  {inv.invested > 0 && <> ({percent(((value - inv.invested) / inv.invested) * 100, 2)})</>}. Estimativa de hoje: {money(inv.balance)}.</p>
              ) : <p>Saldo {inv.is_estimated ? "estimado" : "atual"}: <strong>{money(inv.balance)}</strong></p>
            ) : (
              <>
                <p>{inv.name}: <strong>{money(inv.balance)}</strong>{value > 0 && <> → <strong>{money(Math.max(0, inv.balance + (kind === "deposit" ? value : -value)))}</strong></>}</p>
                {account && <p>{account.name}: <strong>{money(account.balance)}</strong>{value > 0 && <> → <strong className={account.balance + (kind === "deposit" ? -value : value) < 0 ? "text-rose-600" : undefined}>{money(account.balance + (kind === "deposit" ? -value : value))}</strong></>}</p>}
              </>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
