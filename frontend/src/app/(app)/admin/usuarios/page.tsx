"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { api, parseError, type FieldErrors } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { User } from "@/lib/types";
import { useAuth } from "@/components/auth";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Pagination, Select, Skeleton } from "@/components/ui";

interface Stats { users: number; active: number; admins: number; new_this_month: number; active_last_7_days: number; transactions: number }

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<User | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", debounced, role, page],
    queryFn: async () => (await api.get<{ data: User[]; meta: { current_page: number; last_page: number }; stats: Stats }>("/admin/users", { params: { search: debounced || undefined, role: role || undefined, page } })).data,
    enabled: me?.role === "admin",
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const patch = async (u: User, body: Partial<User>) => {
    try {
      await api.put(`/admin/users/${u.id}`, body);
      toast.success("Usuário atualizado");
      refresh();
    } catch (e) { toast.error(parseError(e).message); }
  };

  const remove = async () => {
    try {
      await api.delete(`/admin/users/${toDelete!.id}`);
      toast.success("Usuário excluído");
      refresh();
    } catch (e) { toast.error(parseError(e).message); } finally { setToDelete(null); }
  };

  if (me?.role !== "admin") return <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Acesso restrito" description="Somente administradores podem ver esta página." />;
  if (error) return <EmptyState title="Não foi possível carregar os usuários" />;

  const s = data?.stats;

  return (
    <>
      <PageHeader title="Usuários" description="Administração dos usuários do sistema"
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo usuário</Button>} />

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[["Usuários", s.users], ["Ativos", s.active], ["Admins", s.admins], ["Novos no mês", s.new_this_month], ["Acessaram (7 dias)", s.active_last_7_days], ["Lançamentos", s.transactions]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500">{l}</p><p className="tabular text-xl font-bold text-slate-900 dark:text-white">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" />
        </div>
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="w-auto">
          <option value="">Todos os perfis</option><option value="admin">Administradores</option><option value="user">Usuários</option>
        </Select>
      </div>

      <Card padded={false}>
        {isLoading ? <div className="p-4"><Skeleton className="h-60" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase dark:bg-slate-800/50">
                <tr><th className="px-5 py-3">Usuário</th><th className="px-3 py-3">Perfil</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Lançamentos</th><th className="px-3 py-3">Último acesso</th><th className="px-3 py-3">Cadastro</th><th className="w-12" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.data.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3"><p className="font-medium text-slate-800 dark:text-slate-100">{u.name}{u.id === me.id && <span className="ml-1 text-xs text-slate-400">(você)</span>}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                    <td className="px-3 py-3">
                      <Select value={u.role} disabled={u.id === me.id} onChange={(e) => patch(u, { role: e.target.value as User["role"] })} className="h-8 w-auto text-xs">
                        <option value="user">Usuário</option><option value="admin">Admin</option>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <button disabled={u.id === me.id} onClick={() => patch(u, { is_active: !u.is_active })} title="Clique para ativar/desativar">
                        {u.is_active ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Desativado</Badge>}
                      </button>
                    </td>
                    <td className="tabular px-3 py-3 text-slate-600 dark:text-slate-400">{u.transactions_count}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{u.last_login_at ? fmtDate(u.last_login_at, "dd/MM/yyyy HH:mm") : "Nunca"}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{fmtDate(u.created_at)}</td>
                    <td className="px-3 py-3">
                      {u.id !== me.id && <button onClick={() => setToDelete(u)} className="rounded-md p-1.5 text-slate-400 hover:text-rose-600" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}
      </Card>

      <CreateUser open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title="Excluir usuário" confirmLabel="Excluir"
        message={<>Excluir <strong>{toDelete?.name}</strong> e <strong>todos os dados financeiros</strong> dele? Essa ação não pode ser desfeita.</>} />
    </>
  );
}

type CreateUserProps = { open: boolean; onClose: () => void; onCreated: () => void };

function CreateUser(props: CreateUserProps) {
  return props.open ? <CreateUserInner {...props} /> : null;
}

function CreateUserInner({ onClose, onCreated }: CreateUserProps) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/admin/users", form);
      toast.success("Usuário criado");
      onCreated();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Novo usuário" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="user-form" loading={saving}>Criar</Button></>}>
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label="Nome" error={errors.name}><Input placeholder="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="E-mail" error={errors.email}><Input placeholder="nome@exemplo.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Senha inicial" error={errors.password}><Input placeholder="Mínimo de 8 caracteres" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Field label="Perfil"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="user">Usuário</option><option value="admin">Administrador</option></Select></Field>
      </form>
    </Modal>
  );
}
