"use client";

/**
 * Celular: lançamentos como extrato de banco (agrupados por dia, mais recentes primeiro)
 * e a folha de ações que abre ao tocar num lançamento.
 */

import type { MouseEvent as ReactMouseEvent } from "react";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CircleDashed, Copy, Layers, Pencil, Repeat, Trash2 } from "lucide-react";
import { cn, fmtDate, isInvestmentTx, money, PAYMENT_METHODS, TX_TYPES } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { CategoryIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { Modal } from "@/components/ui";

function dayLabel(date: string) {
  const d = parseISO(date);
  const today = new Date();
  if (isSameDay(d, today)) return "Hoje";
  if (isSameDay(d, addDays(today, -1))) return "Ontem";
  if (isSameDay(d, addDays(today, 1))) return "Amanhã";
  const s = format(d, d.getFullYear() === today.getFullYear() ? "EEEE, d 'de' MMM" : "EEEE, d 'de' MMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(".", "");
}

/** Sinal e cor do valor, do ponto de vista das contas (saída negativa, entrada positiva). */
function amountView(t: Transaction) {
  if (t.type === "income" || t.type === "redeem") return { sign: "+", cls: "text-teal-600 dark:text-teal-400" };
  if (t.type === "expense") return { sign: "−", cls: "text-slate-900 dark:text-white" };
  if (t.type === "invest") return { sign: "−", cls: "text-violet-600 dark:text-violet-400" };
  return { sign: "", cls: "text-slate-500" };
}

function subtitle(t: Transaction) {
  if (isInvestmentTx(t.type)) return `${t.type === "invest" ? "Aplicação em" : "Resgate de"} ${t.investment?.name ?? "investimento"}`;
  if (t.type === "transfer") return `${t.account?.name} → ${t.transfer_account?.name}`;
  return [t.category?.name ?? "Sem categoria", t.account?.name].filter(Boolean).join(" · ");
}

export function MobileStatement({ rows, onOpen, onTogglePaid }: {
  rows: Transaction[];
  onOpen: (t: Transaction) => void;
  onTogglePaid: (t: Transaction, e: ReactMouseEvent) => void;
}) {
  // Mais recentes primeiro, como no extrato do banco.
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const t of sorted) {
    const last = groups[groups.length - 1];
    if (last?.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }

  return (
    <div className="md:hidden">
      {groups.map((g) => {
        const net = g.items.reduce((s, t) => s + (t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0), 0);
        return (
          <section key={g.date}>
            <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 flex items-center justify-between bg-slate-50/95 px-4 py-2 text-xs font-semibold text-slate-500 backdrop-blur dark:bg-slate-900/95">
              <span>{dayLabel(g.date)}</span>
              {net !== 0 && <span className={cn("tabular", net > 0 ? "text-teal-600 dark:text-teal-400" : "")}>{money(net, { sign: true })}</span>}
            </header>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {g.items.map((t) => {
                const a = amountView(t);
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => onOpen(t)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-slate-100 dark:active:bg-slate-800">
                      <CategoryIcon icon={isInvestmentTx(t.type) ? "trending-up" : t.type === "transfer" ? "arrow-left-right" : t.category?.icon}
                        color={t.investment?.color ?? t.category?.color} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-slate-900 dark:text-white">{t.description}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                          {t.installment_total && <span className="inline-flex shrink-0 items-center gap-0.5"><Layers className="h-3 w-3" />{t.installment_number}/{t.installment_total}</span>}
                          {t.recurring_transaction_id && <Repeat className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{subtitle(t)}</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className={cn("tabular text-[15px] font-semibold", a.cls)}>{a.sign}{money(t.amount)}</span>
                        {!t.is_paid && (
                          // Toque no selo marca como pago, sem abrir a folha.
                          <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onTogglePaid(t, e); }}
                            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()}>
                            <StatusBadge t={t} />
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Folha de detalhes/ações de um lançamento (celular). */
export function TxActionSheet({ tx, onClose, onEdit, onTogglePaid, onDuplicate, onDelete }: {
  tx: Transaction | null;
  onClose: () => void;
  onEdit: (t: Transaction) => void;
  onTogglePaid: (t: Transaction, e: ReactMouseEvent) => void;
  onDuplicate: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  if (!tx) return null;
  const a = amountView(tx);
  const linked = isInvestmentTx(tx.type);
  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-medium transition active:scale-[.99]";

  return (
    <Modal open onClose={onClose} title={TX_TYPES[tx.type] ?? "Lançamento"} size="sm">
      <div className="flex flex-col items-center text-center">
        <CategoryIcon icon={linked ? "trending-up" : tx.category?.icon} color={tx.investment?.color ?? tx.category?.color} />
        <p className="mt-2 font-semibold text-slate-900 dark:text-white">{tx.description}</p>
        <p className={cn("tabular mt-1 text-3xl font-bold", a.cls)}>{a.sign}{money(tx.amount)}</p>
        <div className="mt-2"><StatusBadge t={tx} /></div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
        <div><dt className="text-xs text-slate-500">Data</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{fmtDate(tx.date)}</dd></div>
        <div><dt className="text-xs text-slate-500">Conta</dt><dd className="truncate font-medium text-slate-800 dark:text-slate-100">{tx.account?.name ?? "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">{linked ? "Investimento" : "Categoria"}</dt>
          <dd className="truncate font-medium text-slate-800 dark:text-slate-100">{linked ? tx.investment?.name ?? "—" : tx.category?.name ?? (tx.type === "transfer" ? `→ ${tx.transfer_account?.name}` : "Sem categoria")}</dd></div>
        <div><dt className="text-xs text-slate-500">Pagamento</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{tx.payment_method ? PAYMENT_METHODS[tx.payment_method] : "—"}</dd></div>
        {tx.installment_total && <div><dt className="text-xs text-slate-500">Parcela</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{tx.installment_number} de {tx.installment_total}</dd></div>}
        {tx.paid_at && <div><dt className="text-xs text-slate-500">Pago em</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{fmtDate(tx.paid_at)}</dd></div>}
        {tx.notes && <div className="col-span-2"><dt className="text-xs text-slate-500">Observações</dt><dd className="text-slate-700 dark:text-slate-200">{tx.notes}</dd></div>}
      </dl>

      <div className="mt-4 space-y-1">
        {!linked && (
          <button type="button" onClick={(e) => onTogglePaid(tx, e)} className={cn(row, "text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800")}>
            {tx.is_paid ? <CircleDashed className="h-5 w-5 text-slate-400" /> : <Check className="h-5 w-5 text-teal-600" />}
            {tx.is_paid ? "Marcar como em aberto" : tx.type === "income" ? "Marcar como recebido" : "Marcar como pago"}
          </button>
        )}
        <button type="button" onClick={() => onEdit(tx)} className={cn(row, "text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800")}>
          <Pencil className="h-5 w-5 text-slate-400" /> {linked ? "Ver em Investimentos" : "Editar"}
        </button>
        {!linked && (
          <button type="button" onClick={() => onDuplicate(tx)} className={cn(row, "text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800")}>
            <Copy className="h-5 w-5 text-slate-400" /> Duplicar no próximo mês
          </button>
        )}
        <button type="button" onClick={() => onDelete(tx)} className={cn(row, "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10")}>
          <Trash2 className="h-5 w-5" /> Excluir
        </button>
      </div>
    </Modal>
  );
}
