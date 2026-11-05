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
import { tr } from "@/lib/i18n";

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
      toast.success(tr("Usuário atualizado", "User updated"));
      refresh();
    } catch (e) { toast.error(parseError(e).message); }
  };

  const remove = async () => {
    try {
      await api.delete(`/admin/users/${toDelete!.id}`);
      toast.success(tr("Usuário excluído", "User deleted"));
      refresh();
    } catch (e) { toast.error(parseError(e).message); } finally { setToDelete(null); }
  };

  if (me?.role !== "admin") return <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={tr("Acesso restrito", "Restricted access")} description={tr("Somente administradores podem ver esta página.", "Only admins can see this page.")} />;
  if (error) return <EmptyState title={tr("Não foi possível carregar os usuários", "Couldn't load the users")} />;

  const s = data?.stats;

  return (
    <>
      <PageHeader title={tr("Usuários", "Users")} description={tr("Administração dos usuários do sistema", "Manage the system's users")}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> {tr("Novo usuário", "New user")}</Button>} />

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[[tr("Usuários", "Users"), s.users], [tr("Ativos", "Active"), s.active], ["Admins", s.admins], [tr("Novos no mês", "New this month"), s.new_this_month], [tr("Acessaram (7 dias)", "Signed in (7 days)"), s.active_last_7_days], [tr("Lançamentos", "Transactions"), s.transactions]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500">{l}</p><p className="tabular text-xl font-bold text-slate-900 dark:text-white">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Buscar por nome ou e-mail", "Search by name or email")} className="pl-9" />
        </div>
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="w-auto">
          <option value="">{tr("Todos os perfis", "All roles")}</option><option value="admin">{tr("Administradores", "Admins")}</option><option value="user">{tr("Usuários", "Users")}</option>
        </Select>
      </div>

      <Card padded={false}>
        {isLoading ? <div className="p-4"><Skeleton className="h-60" /></div> : (
          <>
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {data?.data.map((u) => (
              <li key={u.id} className="flex items-start gap-3 px-4 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800 dark:text-slate-100">{u.name}{u.id === me.id && <span className="ml-1 text-xs text-slate-400">{tr("(você)", "(you)")}</span>}</p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tr(`${u.transactions_count} lançamentos`, `${u.transactions_count} transactions`)} · {u.last_login_at ? tr(`acesso ${fmtDate(u.last_login_at, "dd/MM HH:mm")}`, `signed in ${fmtDate(u.last_login_at, "dd/MM HH:mm")}`) : tr("nunca acessou", "never signed in")}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Select value={u.role} disabled={u.id === me.id} onChange={(e) => patch(u, { role: e.target.value as User["role"] })} className="h-8 w-auto text-xs">
                      <option value="user">{tr("Usuário", "User")}</option><option value="admin">Admin</option>
                    </Select>
                    <button disabled={u.id === me.id} onClick={() => patch(u, { is_active: !u.is_active })}>
                      {u.is_active ? <Badge tone="green">{tr("Ativo", "Active")}</Badge> : <Badge tone="red">{tr("Desativado", "Disabled")}</Badge>}
                    </button>
                  </div>
                </div>
                {u.id !== me.id && <button onClick={() => setToDelete(u)} className="rounded-lg p-2.5 text-slate-300 active:text-rose-600" aria-label={tr(`Excluir ${u.name}`, `Delete ${u.name}`)}><Trash2 className="h-4.5 w-4.5" /></button>}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase dark:bg-slate-800/50">
                <tr><th className="px-5 py-3">{tr("Usuário", "User")}</th><th className="px-3 py-3">{tr("Perfil", "Role")}</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">{tr("Lançamentos", "Transactions")}</th><th className="px-3 py-3">{tr("Último acesso", "Last sign-in")}</th><th className="px-3 py-3">{tr("Cadastro", "Created")}</th><th className="w-12" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.data.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3"><p className="font-medium text-slate-800 dark:text-slate-100">{u.name}{u.id === me.id && <span className="ml-1 text-xs text-slate-400">{tr("(você)", "(you)")}</span>}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                    <td className="px-3 py-3">
                      <Select value={u.role} disabled={u.id === me.id} onChange={(e) => patch(u, { role: e.target.value as User["role"] })} className="h-8 w-auto text-xs">
                        <option value="user">{tr("Usuário", "User")}</option><option value="admin">Admin</option>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <button disabled={u.id === me.id} onClick={() => patch(u, { is_active: !u.is_active })} title={tr("Clique para ativar/desativar", "Click to enable/disable")}>
                        {u.is_active ? <Badge tone="green">{tr("Ativo", "Active")}</Badge> : <Badge tone="red">{tr("Desativado", "Disabled")}</Badge>}
                      </button>
                    </td>
                    <td className="tabular px-3 py-3 text-slate-600 dark:text-slate-400">{u.transactions_count}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{u.last_login_at ? fmtDate(u.last_login_at, "dd/MM/yyyy HH:mm") : tr("Nunca", "Never")}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{fmtDate(u.created_at)}</td>
                    <td className="px-3 py-3">
                      {u.id !== me.id && <button onClick={() => setToDelete(u)} className="rounded-md p-1.5 text-slate-400 hover:text-rose-600" aria-label={tr("Excluir", "Delete")}><Trash2 className="h-4 w-4" /></button>}
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

      <CreateUser open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} title={tr("Excluir usuário", "Delete user")} confirmLabel={tr("Excluir", "Delete")}
        message={<>{tr("Excluir ", "Delete ")}<strong>{toDelete?.name}</strong>{tr(" e ", " and ")}<strong>{tr("todos os dados financeiros", "all financial data")}</strong>{tr(" dele? Essa ação não pode ser desfeita.", "? This can't be undone.")}</>} />
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
      toast.success(tr("Usuário criado", "User created"));
      onCreated();
      onClose();
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={tr("Novo usuário", "New user")} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancelar", "Cancel")}</Button><Button type="submit" form="user-form" loading={saving}>{tr("Criar", "Create")}</Button></>}>
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label={tr("Nome", "Name")} error={errors.name}><Input placeholder={tr("Nome completo", "Full name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label={tr("E-mail", "Email")} error={errors.email}><Input placeholder={tr("nome@exemplo.com", "name@example.com")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label={tr("Senha inicial", "Initial password")} error={errors.password}><Input placeholder={tr("Mínimo de 8 caracteres", "At least 8 characters")} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Field label={tr("Perfil", "Role")}><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="user">{tr("Usuário", "User")}</option><option value="admin">{tr("Administrador", "Administrator")}</option></Select></Field>
      </form>
    </Modal>
  );
}
