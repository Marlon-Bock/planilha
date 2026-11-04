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
      toast.success("Categoria excluída");
      invalidate();
    } catch (e) { toast.error(parseError(e).message); } finally { setToDelete(null); setMoveTo(""); }
  };

  const open = (type: "income" | "expense", c: Category | null = null) => { setNewType(type); setEditing(c); setFormOpen(true); };

  return (
    <>
      <PageHeader title="Categorias e tags" description={`Organize seus lançamentos. Totais referentes a ${monthLabel(month).toLowerCase()}.`} />

      <div className="grid gap-6 lg:grid-cols-2">
        {(["expense", "income"] as const).map((type) => (
          <Card key={type} padded={false} title={type === "expense" ? "Categorias de despesa" : "Categorias de receita"}
            action={<Button size="sm" variant="outline" onClick={() => open(type)}><Plus className="h-4 w-4" /> Nova</Button>}>
            {isLoading ? <div className="p-4"><Skeleton className="h-60" /></div> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {categories.filter((c) => c.type === type).map((c) => (
                  <li key={c.id} className={cn("group flex items-center gap-3 px-5 py-3", c.is_archived && "opacity-50")}>
                    <CategoryIcon icon={c.icon} color={c.color} />
                    <div className="min-w-0 flex-1">
                      <TxLink filters={{ category_ids: [c.id] }} className="block truncate text-sm font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100">{c.name}</TxLink>
                      <p className="text-xs text-slate-500">{c.transactions_count ?? 0} lançamento(s)</p>
                    </div>
                    {c.is_archived && <Badge>Arquivada</Badge>}
                    <span className="tabular text-sm text-slate-600 dark:text-slate-300">{money(c.month_total)}</span>
                    <div className="flex opacity-50 group-hover:opacity-100">
                      <button className="rounded-md p-1.5 text-slate-400 hover:text-slate-700" onClick={() => open(type, c)} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                      <button className="rounded-md p-1.5 text-slate-400 hover:text-rose-600" onClick={() => setToDelete(c)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
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

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title="Excluir categoria" confirmLabel="Excluir"
        message={<>Excluir <strong>{toDelete?.name}</strong>? Os orçamentos dela também serão removidos.</>}>
        {!!toDelete?.transactions_count && (
          <Field label={`Mover os ${toDelete.transactions_count} lançamento(s) para:`} hint="Se não escolher, eles ficam sem categoria.">
            <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Deixar sem categoria</option>
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
      toast.success("Categoria salva");
      invalidate();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={category ? "Editar categoria" : `Nova categoria de ${type === "income" ? "receita" : "despesa"}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="cat-form" loading={saving}>Salvar</Button></>}>
      <form id="cat-form" onSubmit={submit} className="space-y-4">
        <Field label="Nome" error={errors.name}>
          <div className="flex items-center gap-2">
            <CategoryIcon icon={form.icon} color={form.color} />
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errors.name}
              placeholder={type === "income" ? "Ex.: Salário, Freelance, Aluguel recebido" : "Ex.: Mercado, Academia, Pet shop"} />
          </div>
        </Field>
        <Field label="Cor" group hint="Escolha uma das sugestões ou clique no último círculo para qualquer cor"><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} /></Field>
        <Field label="Ícone" group><IconPicker value={form.icon} color={form.color} onChange={(icon) => setForm({ ...form, icon })} /></Field>
        {category && <Toggle checked={form.is_archived} onChange={(v) => setForm({ ...form, is_archived: v })} label="Arquivada (some dos formulários)" />}
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
    if (!confirm(`Excluir a tag "${t.name}"? Ela será removida dos lançamentos.`)) return;
    await api.delete(`/tags/${t.id}`);
    qc.invalidateQueries({ queryKey: ["tags"] });
  };

  return (
    <Card className="mt-6" title="Tags" action={<Button size="sm" variant="outline" onClick={() => { setEditing(null); setName(""); setColor("#0ea5e9"); setOpen(true); }}><Plus className="h-4 w-4" /> Nova tag</Button>}>
      <p className="mb-4 text-sm text-slate-500">Tags cruzam categorias — ex.: <em>#viagem</em>, <em>#família</em>, <em>#trabalho</em>. Use nos filtros e relatórios.</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t.id} className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-sm font-medium text-white" style={{ backgroundColor: t.color }}>
            #{t.name} <span className="text-xs opacity-80">({t.transactions_count})</span>
            <button onClick={() => { setEditing(t); setName(t.name); setColor(t.color); setOpen(true); }} className="rounded-full p-0.5 hover:bg-white/20" aria-label="Editar"><Pencil className="h-3 w-3" /></button>
            <button onClick={() => remove(t)} className="rounded-full p-0.5 hover:bg-white/20" aria-label="Excluir"><Trash2 className="h-3 w-3" /></button>
          </span>
        ))}
        {!tags.length && <p className="text-sm text-slate-400">Nenhuma tag ainda.</p>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar tag" : "Nova tag"} size="sm"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="tag-form">Salvar</Button></>}>
        <form id="tag-form" onSubmit={save} className="space-y-4">
          <Field label="Nome"><Input placeholder="Ex.: viagem, família, trabalho" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Cor" group><ColorPicker value={color} onChange={setColor} /></Field>
        </form>
      </Modal>
    </Card>
  );
}
