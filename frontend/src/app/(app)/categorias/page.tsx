"use client";

import { TxLink } from "@/components/filter-link";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, parseError, type FieldErrors } from "@/lib/api";
import { cn, currentMonth, money, monthLabel } from "@/lib/format";
import { useCategories, useInvalidateFinance, useTags } from "@/lib/queries";
import type { Category, Tag } from "@/lib/types";
import { Badge, Button, Card, ColorPicker, ConfirmDialog, Field, Input, Modal, PageHeader, Select, Skeleton, Toggle } from "@/components/ui";
import { CategoryIcon } from "@/components/icons";
import { IconPicker } from "@/components/icon-picker";
import { tr } from "@/lib/i18n";

export default function CategoriesPage() {
  const month = currentMonth();
  const { data: categories = [], isLoading } = useCategories(month);
  const [editing, setEditing] = useState<Category | null>(null);
  const [newType, setNewType] = useState<"income" | "expense">("expense");
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const invalidate = useInvalidateFinance();

  const remove = async () => {
    try {
      await api.delete(`/categories/${toDelete!.id}`, { params: { move_to: moveTo || undefined } });
      toast.success(tr("Categoria excluída", "Category deleted"));
      invalidate();
    } catch (e) { toast.error(parseError(e).message); } finally { setToDelete(null); setMoveTo(""); }
  };

  const open = (type: "income" | "expense", c: Category | null = null) => { setNewType(type); setEditing(c); setFormOpen(true); };

  return (
    <>
      <PageHeader title={tr("Categorias e tags", "Categories & tags")} description={tr(`Organize seus lançamentos. Totais referentes a ${monthLabel(month).toLowerCase()}.`, `Organize your transactions. Totals for ${monthLabel(month)}.`)} />

      <div className="grid gap-6 lg:grid-cols-2">
        {(["expense", "income"] as const).map((type) => (
          <Card key={type} padded={false} title={type === "expense" ? tr("Categorias de despesa", "Expense categories") : tr("Categorias de receita", "Income categories")}
            action={<Button size="sm" variant="outline" onClick={() => open(type)}><Plus className="h-4 w-4" /> {tr("Nova", "New")}</Button>}>
            {isLoading ? <div className="p-4"><Skeleton className="h-60" /></div> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {categories.filter((c) => c.type === type).map((c) => (
                  <li key={c.id} className={cn("group flex items-center gap-3 px-5 py-3", c.is_archived && "opacity-50")}>
                    <CategoryIcon icon={c.icon} color={c.color} />
                    <div className="min-w-0 flex-1">
                      <TxLink filters={{ category_ids: [c.id] }} className="block truncate text-sm font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100">{c.name}</TxLink>
                      <p className="truncate text-xs text-slate-500">{tr(`${c.transactions_count ?? 0} lançamento(s)`, `${c.transactions_count ?? 0} transaction(s)`)}</p>
                    </div>
                    {c.is_archived && <Badge>{tr("Arquivada", "Archived")}</Badge>}
                    <span className="tabular shrink-0 text-sm text-slate-600 dark:text-slate-300">{money(c.month_total)}</span>
                    <div className="flex shrink-0 opacity-50 group-hover:opacity-100">
                      <button className="rounded-md p-1.5 text-slate-400 hover:text-slate-700" onClick={() => open(type, c)} aria-label={tr("Editar", "Edit")}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded-md p-1.5 text-slate-400 hover:text-rose-600" onClick={() => setToDelete(c)} aria-label={tr("Excluir", "Delete")}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <TagsCard />

      <CategoryForm open={formOpen} onClose={() => setFormOpen(false)} category={editing} type={newType} />

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title={tr("Excluir categoria", "Delete category")} confirmLabel={tr("Excluir", "Delete")}
        message={<>{tr("Excluir ", "Delete ")}<strong>{toDelete?.name}</strong>{tr("? Os orçamentos dela também serão removidos.", "? Its budgets will also be removed.")}</>}>
        {!!toDelete?.transactions_count && (
          <Field label={tr(`Mover os ${toDelete.transactions_count} lançamento(s) para:`, `Move the ${toDelete.transactions_count} transaction(s) to:`)} hint={tr("Se não escolher, eles ficam sem categoria.", "If you don't choose, they'll have no category.")}>
            <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">{tr("Deixar sem categoria", "Leave without category")}</option>
              {categories.filter((c) => c.type === toDelete.type && c.id !== toDelete.id).map((c) => <option key={c.id} value={c.id} data-color={c.color}>{c.name}</option>)}
            </Select>
          </Field>
        )}
      </ConfirmDialog>
    </>
  );
}

type CategoryFormProps = { open: boolean; onClose: () => void; category: Category | null; type: "income" | "expense" };

function CategoryForm(props: CategoryFormProps) {
  return props.open ? <CategoryFormInner key={props.category?.id ?? `new-${props.type}`} {...props} /> : null;
}

function CategoryFormInner({ onClose, category, type }: CategoryFormProps) {
  const [form, setForm] = useState(() => category
    ? { name: category.name, color: category.color, icon: category.icon, is_archived: category.is_archived }
    : { name: "", color: "#6366f1", icon: "tag", is_archived: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateFinance();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (category) await api.put(`/categories/${category.id}`, form);
      else await api.post("/categories", { ...form, type });
      toast.success(tr("Categoria salva", "Category saved"));
      invalidate();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={category ? tr("Editar categoria", "Edit category") : type === "income" ? tr("Nova categoria de receita", "New income category") : tr("Nova categoria de despesa", "New expense category")}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancelar", "Cancel")}</Button><Button type="submit" form="cat-form" loading={saving}>{tr("Salvar", "Save")}</Button></>}>
      <form id="cat-form" onSubmit={submit} className="space-y-4">
        <Field label={tr("Nome", "Name")} error={errors.name}>
          <div className="flex items-center gap-2">
            <CategoryIcon icon={form.icon} color={form.color} />
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errors.name}
              placeholder={type === "income" ? tr("Ex.: Salário, Freelance, Aluguel recebido", "E.g. Salary, Freelance, Rent received") : tr("Ex.: Mercado, Academia, Pet shop", "E.g. Groceries, Gym, Pet shop")} />
          </div>
        </Field>
        <Field label={tr("Cor", "Color")} group hint={tr("Escolha uma das sugestões ou clique no último círculo para qualquer cor", "Pick a suggestion or click the last circle for any color")}><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} /></Field>
        <Field label={tr("Ícone", "Icon")} group><IconPicker value={form.icon} color={form.color} onChange={(icon) => setForm({ ...form, icon })} /></Field>
        {category && <Toggle checked={form.is_archived} onChange={(v) => setForm({ ...form, is_archived: v })} label={tr("Arquivada (some dos formulários)", "Archived (hidden from forms)")} />}
      </form>
    </Modal>
  );
}

function TagsCard() {
  const { data: tags = [] } = useTags();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0ea5e9");
  const [open, setOpen] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/tags/${editing.id}`, { name, color });
      else await api.post("/tags", { name, color });
      qc.invalidateQueries({ queryKey: ["tags"] });
      setOpen(false);
    } catch (err) { toast.error(parseError(err).message); }
  };

  const remove = async (t: Tag) => {
    if (!confirm(tr(`Excluir a tag "${t.name}"? Ela será removida dos lançamentos.`, `Delete the tag "${t.name}"? It will be removed from transactions.`))) return;
    await api.delete(`/tags/${t.id}`);
    qc.invalidateQueries({ queryKey: ["tags"] });
  };

  return (
    <Card className="mt-6" title="Tags" action={<Button size="sm" variant="outline" onClick={() => { setEditing(null); setName(""); setColor("#0ea5e9"); setOpen(true); }}><Plus className="h-4 w-4" /> {tr("Nova tag", "New tag")}</Button>}>
      <p className="mb-4 text-sm text-slate-500">{tr("Tags cruzam categorias — ex.: ", "Tags cut across categories — e.g. ")}<em>#{tr("viagem", "trip")}</em>, <em>#{tr("família", "family")}</em>, <em>#{tr("trabalho", "work")}</em>{tr(". Use nos filtros e relatórios.", ". Use them in filters and reports.")}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t.id} className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-sm font-medium text-white" style={{ backgroundColor: t.color }}>
            #{t.name} <span className="text-xs opacity-80">({t.transactions_count})</span>
            <button onClick={() => { setEditing(t); setName(t.name); setColor(t.color); setOpen(true); }} className="rounded-full p-0.5 hover:bg-white/20" aria-label={tr("Editar", "Edit")}><Pencil className="h-3 w-3" /></button>
            <button onClick={() => remove(t)} className="rounded-full p-0.5 hover:bg-white/20" aria-label={tr("Excluir", "Delete")}><Trash2 className="h-3 w-3" /></button>
          </span>
        ))}
        {!tags.length && <p className="text-sm text-slate-400">{tr("Nenhuma tag ainda.", "No tags yet.")}</p>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? tr("Editar tag", "Edit tag") : tr("Nova tag", "New tag")} size="sm"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{tr("Cancelar", "Cancel")}</Button><Button type="submit" form="tag-form">{tr("Salvar", "Save")}</Button></>}>
        <form id="tag-form" onSubmit={save} className="space-y-4">
          <Field label={tr("Nome", "Name")}><Input placeholder={tr("Ex.: viagem, família, trabalho", "E.g. trip, family, work")} autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={tr("Cor", "Color")} group><ColorPicker value={color} onChange={setColor} /></Field>
        </form>
      </Modal>
    </Card>
  );
}
