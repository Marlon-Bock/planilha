"use client";

import { useEffect, useMemo, useState } from "react";
import { clearTxIntent, useTxIntent } from "@/lib/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy, Download, Layers, Pencil, Repeat, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { api, parseError } from "@/lib/api";
import { cn, currentMonth, fmtDate, isInvestmentTx, money, PAYMENT_METHODS } from "@/lib/format";
import { useAccounts, useCategories, useInvalidateFinance, useTags } from "@/lib/queries";
import type { Paginated, Totals, Transaction } from "@/lib/types";
import { Button, Card, Checkbox, ConfirmDialog, DatePicker, Dot, EmptyState, Input, Modal, MoneyInput, MonthPicker, MultiSelect, PageHeader, Pagination, Select, Skeleton, Field } from "@/components/ui";
import { CategoryIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { useTxForm } from "@/components/app-shell";
import { burstFrom } from "@/components/cute";
import { MobileStatement, TxActionSheet } from "@/components/mobile-statement";

interface Filters {
  period: "month" | "range" | "all";
  month: string;
  from: string;
  to: string;
  search: string;
  type: string;
  status: string;
  account_ids: number[];
  category_ids: number[];
  tag_ids: number[];
  payment_method: string;
  min_amount: string;
  max_amount: string;
  sort: string;
  direction: "asc" | "desc";
  per_page: number;
}

const defaultFilters = (): Filters => ({
  period: "month", month: currentMonth(), from: "", to: "", search: "", type: "", status: "",
  account_ids: [], category_ids: [], tag_ids: [], payment_method: "", min_amount: "", max_amount: "",
  sort: "date", direction: "asc", per_page: 50,
});

function toParams(f: Filters, page?: number) {
  const p: Record<string, unknown> = { sort: f.sort, direction: f.direction, per_page: f.per_page, page };
  if (f.period === "month") p.month = f.month;
  if (f.period === "range") { if (f.from) p.from = f.from; if (f.to) p.to = f.to; }
  for (const k of ["search", "type", "status", "payment_method", "min_amount", "max_amount"] as const) if (f[k]) p[k] = f[k];
  for (const k of ["account_ids", "category_ids", "tag_ids"] as const) if (f[k].length) p[k] = f[k];
  return p;
}

function toQueryString(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => qs.append(`${k}[]`, String(x)));
    else qs.append(k, String(v));
  }
  return qs.toString();
}

export default function TransactionsPage() {
  const [filters, setFiltersState] = useState<Filters>(defaultFilters);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  const [deleteScope, setDeleteScope] = useState("this");
  const [bulkDelete, setBulkDelete] = useState(false);
  const [bulkCategory, setBulkCategory] = useState(false);
  const [busy, setBusy] = useState(false);
  // Celular: lançamento tocado no extrato (abre a folha de ações).
  const [sheetTx, setSheetTx] = useState<Transaction | null>(null);

  // Qualquer mudança de filtro volta para a página 1 e limpa a seleção.
  const setFilters = (next: Filters | ((f: Filters) => Filters)) => {
    setFiltersState(next);
    setPage(1);
    setSelected([]);
  };

  const { openNew, openEdit } = useTxForm();
  const invalidate = useInvalidateFinance();
  const { data: accountsData } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const accounts = accountsData?.data ?? [];

  // Aplica filtros enviados por outras telas (dashboard, contas, avisos...) sem usar a URL.
  const intent = useTxIntent();
  const [appliedIntent, setAppliedIntent] = useState<number | null>(null);
  if (intent && intent.id !== appliedIntent) {
    setAppliedIntent(intent.id);
    setFilters({
      ...defaultFilters(),
      period: intent.month ? "month" : intent.status ? "all" : "month",
      month: intent.month ?? currentMonth(),
      status: intent.status ?? "",
      category_ids: intent.category_ids ?? [],
      account_ids: intent.account_ids ?? [],
    });
    setSearchInput("");
    setShowFilters(true);
  }
  // Depois de aplicado, descarta para não reaplicar numa próxima visita.
  useEffect(() => { if (intent) clearTxIntent(intent.id); }, [intent]);

  // Busca com debounce.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput })), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(() => toParams(filters, page), [filters, page]);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["transactions", params],
    queryFn: async () => (await api.get<Paginated<Transaction> & { totals: Totals }>("/transactions", { params })).data,
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const totals = data?.totals;
  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const activeCount = [filters.type, filters.status, filters.payment_method, filters.min_amount, filters.max_amount].filter(Boolean).length
    + (filters.account_ids.length ? 1 : 0) + (filters.category_ids.length ? 1 : 0) + (filters.tag_ids.length ? 1 : 0);

  const sortBy = (col: string) => update({ sort: col, direction: filters.sort === col && filters.direction === "asc" ? "desc" : "asc" });

  const togglePaid = async (t: Transaction, e: React.MouseEvent) => {
    if (!t.is_paid) burstFrom(e); // corações só ao marcar como pago
    try {
      await api.patch(`/transactions/${t.id}/pay`);
      invalidate();
    } catch (e) { toast.error(parseError(e).message); }
  };

  const duplicate = async (t: Transaction) => {
    await api.post(`/transactions/${t.id}/duplicate`);
    toast.success("Lançamento duplicado para o mês seguinte");
    invalidate();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      const { data } = await api.delete<{ deleted: number }>(`/transactions/${toDelete.id}`, { params: { scope: deleteScope } });
      toast.success(data.deleted > 1 ? `${data.deleted} lançamentos excluídos` : "Lançamento excluído");
      setToDelete(null);
      invalidate();
    } finally { setBusy(false); }
  };

  const bulk = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const { data } = await api.post<{ affected: number }>("/transactions/bulk", { ids: selected, action, ...extra });
      toast.success(`${data.affected} lançamento(s) atualizado(s)`);
      setSelected([]);
      setBulkDelete(false);
      setBulkCategory(false);
      invalidate();
    } catch (e) { toast.error(parseError(e).message); } finally { setBusy(false); }
  };

  const exportUrl = `/api/transactions/export?${toQueryString({ ...params, page: undefined, per_page: undefined })}`;
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <>
      <PageHeader title="Lançamentos" description="Sua planilha de receitas e despesas"
        actions={<>
          <a href={exportUrl} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <Download className="h-4 w-4" /> Exportar CSV
          </a>
          {/* No celular o "+" da barra de baixo faz isso. */}
          <Button onClick={() => openNew()} className="hidden lg:inline-flex">Novo lançamento</Button>
        </>} />

      {/* Barra de filtros */}
      <Card className="mb-4" padded={false}>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <Select value={filters.period} onChange={(e) => update({ period: e.target.value as Filters["period"] })} className="w-auto">
            <option value="month">Mês</option>
            <option value="range">Período</option>
            <option value="all">Tudo</option>
          </Select>
          {filters.period === "month" && <MonthPicker value={filters.month} onChange={(m) => update({ month: m })} />}
          {filters.period === "range" && (
            <div className="flex items-center gap-2">
              <DatePicker value={filters.from} onChange={(v) => update({ from: v })} clearable placeholder="dd/mm/aaaa" className="w-44" />
              <span className="text-slate-400">até</span>
              <DatePicker value={filters.to} onChange={(v) => update({ to: v })} clearable placeholder="dd/mm/aaaa" className="w-44" />
            </div>
          )}
          <div className="relative min-w-48 flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar descrição ou observação..." className="pl-9" />
          </div>
          <Select value={filters.status} onChange={(e) => update({ status: e.target.value })} className="w-auto">
            <option value="">Todos os status</option>
            <option value="paid">Pagos / recebidos</option>
            <option value="unpaid">Em aberto</option>
            <option value="pending">A vencer</option>
            <option value="overdue">Vencidos</option>
          </Select>
          <Button variant={showFilters || activeCount ? "secondary" : "outline"} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="h-4 w-4" /> Filtros {activeCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{activeCount}</span>}
          </Button>
          {(activeCount > 0 || filters.search) && (
            <Button variant="ghost" onClick={() => { setFilters({ ...defaultFilters(), period: filters.period, month: filters.month, from: filters.from, to: filters.to }); setSearchInput(""); }}>
              <X className="h-4 w-4" /> Limpar
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
            <Select value={filters.type} onChange={(e) => update({ type: e.target.value })}>
              <option value="">Receitas, despesas e transferências</option>
              <option value="expense">Somente despesas</option>
              <option value="income">Somente receitas</option>
              <option value="transfer">Somente transferências</option>
              <option value="invest">Aplicações em investimentos</option>
              <option value="redeem">Resgates de investimentos</option>
            </Select>
            <MultiSelect label="Contas" options={accounts} value={filters.account_ids} onChange={(v) => update({ account_ids: v })} />
            <MultiSelect label="Categorias" options={filters.type && filters.type !== "transfer" ? categories.filter((c) => c.type === filters.type) : categories} value={filters.category_ids} onChange={(v) => update({ category_ids: v })} />
            <MultiSelect label="Tags" options={tags} value={filters.tag_ids} onChange={(v) => update({ tag_ids: v })} />
            <Select value={filters.payment_method} onChange={(e) => update({ payment_method: e.target.value })}>
              <option value="">Qualquer forma de pagamento</option>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <MoneyInput placeholder="Valor mínimo" value={filters.min_amount} onChange={(_, n) => update({ min_amount: n === null ? "" : String(Math.abs(n)) })} />
            <MoneyInput placeholder="Valor máximo" value={filters.max_amount} onChange={(_, n) => update({ max_amount: n === null ? "" : String(Math.abs(n)) })} />
            <Select value={filters.per_page} onChange={(e) => update({ per_page: Number(e.target.value) })}>
              {[25, 50, 100, 200, 500].map((n) => <option key={n} value={n}>{n} por página</option>)}
            </Select>
          </div>
        )}
      </Card>

      {/* Totais do filtro */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TotalBox label="Receitas" value={totals?.income} detail={totals && `${money(totals.income_pending)} a receber`} tone="text-teal-600 dark:text-teal-400" />
        <TotalBox label="Despesas" value={totals?.expense} detail={totals && `${money(totals.expense_pending)} a pagar`} tone="text-rose-600 dark:text-rose-400" />
        <TotalBox label="Resultado" value={totals?.balance} tone={totals && totals.balance < 0 ? "text-rose-600" : "text-slate-900 dark:text-white"} />
        <TotalBox label="Lançamentos" raw={totals?.count} />
      </div>

      {/* Ações em massa */}
      {selected.length > 0 && (
        <div className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-500/30 dark:bg-brand-950">
          <span className="font-medium text-brand-800 dark:text-brand-200">{selected.length} selecionado(s)</span>
          <div className="flex-1" />
          <Button size="sm" variant="success" loading={busy} onClick={(e) => { burstFrom(e, 16); bulk("pay"); }}><Check className="h-4 w-4" /> Marcar pagos</Button>
          <Button size="sm" variant="outline" onClick={() => bulk("unpay")}>Marcar em aberto</Button>
          <Button size="sm" variant="outline" onClick={() => setBulkCategory(true)}>Mudar categoria</Button>
          <Button size="sm" variant="danger" onClick={() => setBulkDelete(true)}><Trash2 className="h-4 w-4" /> Excluir</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Cancelar</Button>
        </div>
      )}

      {/* Tabela */}
      {/* Celular: extrato de ponta a ponta (sem "overflow-hidden", senão o título do dia não gruda no topo). */}
      <Card padded={false} className={cn("transition-opacity md:overflow-hidden max-md:-mx-4 max-md:rounded-none max-md:border-x-0 max-md:shadow-none", isFetching && "opacity-70")}>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Search className="h-6 w-6" />} title="Nenhum lançamento encontrado" description="Ajuste os filtros ou adicione um novo lançamento."
            action={<Button onClick={() => openNew()}>Novo lançamento</Button>} />
        ) : (
          <>
          {/* Celular: extrato agrupado por dia, como nos apps de banco. */}
          <MobileStatement rows={rows} onOpen={setSheetTx} onTogglePaid={togglePaid} />
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase dark:bg-slate-800/50">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <Checkbox checked={allSelected} indeterminate={selected.length > 0 && !allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.id))} aria-label="Selecionar todos" />
                  </th>
                  <SortTh col="date" label="Data" f={filters} onSort={sortBy} />
                  <SortTh col="description" label="Descrição" f={filters} onSort={sortBy} />
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3">Conta</th>
                  <th className="px-3 py-3">Status</th>
                  <SortTh col="amount" label="Valor" f={filters} onSort={sortBy} className="text-right" />
                  <th className="w-24 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((t) => (
                  <tr key={t.id} className={cn("group hover:bg-slate-50 dark:hover:bg-slate-800/40", selected.includes(t.id) && "bg-brand-50/60 dark:bg-brand-500/5")}>
                    <td className="px-4 py-2.5">
                      <Checkbox checked={selected.includes(t.id)} onChange={() => setSelected((s) => s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id])} aria-label={`Selecionar ${t.description}`} />
                    </td>
                    <td className="tabular px-3 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-400">{fmtDate(t.date)}</td>
                    <td className="max-w-72 px-3 py-2.5">
                      <button onClick={() => openEdit(t)} className="block max-w-full truncate text-left font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100">{t.description}</button>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {t.installment_total && <span className="inline-flex items-center gap-0.5"><Layers className="h-3 w-3" />{t.installment_number}/{t.installment_total}</span>}
                        {t.recurring_transaction_id && <span className="inline-flex items-center gap-0.5"><Repeat className="h-3 w-3" />Recorrente</span>}
                        {t.payment_method && <span>{PAYMENT_METHODS[t.payment_method]}</span>}
                        {t.tags?.map((tag) => <span key={tag.id} className="rounded px-1 text-white" style={{ backgroundColor: tag.color }}>#{tag.name}</span>)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {isInvestmentTx(t.type) ? (
                        <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          <CategoryIcon icon="trending-up" color={t.investment?.color ?? "#7c3aed"} size="sm" />
                          <span className="truncate">{t.type === "invest" ? "Aplicação →" : "Resgate ←"} {t.investment?.name ?? "investimento excluído"}</span>
                        </span>
                      ) : t.type === "transfer" ? (
                        <span className="text-xs text-slate-500">Transferência → {t.transfer_account?.name}</span>
                      ) : t.category ? (
                        <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300"><CategoryIcon icon={t.category.icon} color={t.category.color} size="sm" /><span className="truncate">{t.category.name}</span></span>
                      ) : <span className="text-xs text-slate-400">Sem categoria</span>}
                    </td>
                    <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400"><Dot color={t.account?.color} />{t.account?.name}</span></td>
                    <td className="px-3 py-2.5">
                      {isInvestmentTx(t.type)
                        ? <StatusBadge t={t} />
                        : <button onClick={(e) => togglePaid(t, e)} title="Clique para alternar o status"><StatusBadge t={t} /></button>}
                    </td>
                    <td className={cn("tabular px-3 py-2.5 text-right font-semibold whitespace-nowrap",
                      t.type === "income" ? "text-teal-600 dark:text-teal-400" : t.type === "expense" ? "text-slate-900 dark:text-white" : isInvestmentTx(t.type) ? "text-violet-600 dark:text-violet-400" : "text-slate-500")}>
                      {t.type === "expense" || t.type === "invest" ? "−" : t.type === "income" || t.type === "redeem" ? "+" : ""}{money(t.amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                        <IconBtn title={isInvestmentTx(t.type) ? "Ver em Investimentos" : "Editar"} onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></IconBtn>
                        {!isInvestmentTx(t.type) && <IconBtn title="Duplicar no próximo mês" onClick={() => duplicate(t)}><Copy className="h-4 w-4" /></IconBtn>}
                        <IconBtn title="Excluir" danger onClick={() => { setDeleteScope("this"); setToDelete(t); }}><Trash2 className="h-4 w-4" /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}
      </Card>

      <TxActionSheet tx={sheetTx} onClose={() => setSheetTx(null)}
        onEdit={(t) => { setSheetTx(null); openEdit(t); }}
        onTogglePaid={(t, e) => { setSheetTx(null); togglePaid(t, e); }}
        onDuplicate={(t) => { setSheetTx(null); duplicate(t); }}
        onDelete={(t) => { setSheetTx(null); setDeleteScope("this"); setToDelete(t); }} />

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} loading={busy} title="Excluir lançamento" confirmLabel="Excluir"
        message={<>Excluir <strong>{toDelete?.description}</strong> ({money(toDelete?.amount)})? Essa ação não pode ser desfeita.
          {toDelete && isInvestmentTx(toDelete.type) && <> A movimentação correspondente no investimento também será removida.</>}</>}>
        {toDelete?.installment_group && (
          <Field label="Este lançamento é parcelado. Excluir:">
            <Select value={deleteScope} onChange={(e) => setDeleteScope(e.target.value)}>
              <option value="this">Somente esta parcela</option>
              <option value="future">Esta e as próximas</option>
              <option value="all">Todas as parcelas</option>
            </Select>
          </Field>
        )}
      </ConfirmDialog>

      <ConfirmDialog open={bulkDelete} onClose={() => setBulkDelete(false)} onConfirm={() => bulk("delete")} loading={busy} title="Excluir lançamentos" confirmLabel="Excluir todos"
        message={<>Excluir <strong>{selected.length}</strong> lançamento(s) selecionado(s)? Essa ação não pode ser desfeita.</>} />

      <BulkCategoryModal open={bulkCategory} onClose={() => setBulkCategory(false)} onApply={(id) => bulk("category", { category_id: id })} busy={busy} />
    </>
  );
}

function BulkCategoryModal({ open, onClose, onApply, busy }: { open: boolean; onClose: () => void; onApply: (id: number) => void; busy: boolean }) {
  const { data: categories = [] } = useCategories();
  const [value, setValue] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Mudar categoria" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!value} loading={busy} onClick={() => onApply(Number(value))}>Aplicar</Button></>}>
      <Select value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">Selecione</option>
        <optgroup label="Despesas">{categories.filter((c) => c.type === "expense").map((c) => <option key={c.id} value={c.id} data-color={c.color}>{c.name}</option>)}</optgroup>
        <optgroup label="Receitas">{categories.filter((c) => c.type === "income").map((c) => <option key={c.id} value={c.id} data-color={c.color}>{c.name}</option>)}</optgroup>
      </Select>
      <p className="mt-2 text-xs text-slate-500">Transferências selecionadas são ignoradas.</p>
    </Modal>
  );
}

function SortTh({ col, label, f, onSort, className }: { col: string; label: string; f: Filters; onSort: (c: string) => void; className?: string }) {
  const Icon = f.sort !== col ? ArrowUpDown : f.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-3 py-3", className)}>
      <button onClick={() => onSort(col)} className={cn("inline-flex items-center gap-1 uppercase hover:text-slate-800 dark:hover:text-slate-200", f.sort === col && "text-slate-800 dark:text-slate-200")}>
        {label} <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className={cn("rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800", danger ? "hover:text-rose-600" : "hover:text-slate-700 dark:hover:text-slate-200")}>
      {children}
    </button>
  );
}

function TotalBox({ label, value, raw, detail, tone }: { label: string; value?: number; raw?: number; detail?: string | false; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("tabular text-lg font-bold", tone ?? "text-slate-900 dark:text-white")}>{raw !== undefined ? raw : value !== undefined ? money(value) : "—"}</p>
      {detail && <p className="text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

