"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, parseError, type FieldErrors } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuth } from "@/components/auth";
import { Badge, Button, Card, ConfirmDialog, DatePicker, Field, Input, PageHeader, Select, Toggle } from "@/components/ui";
import { Cat, Heart, useCuteMode } from "@/components/cute";

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  // O AppShell só renderiza as páginas com o usuário carregado.
  const [profile, setProfile] = useState(() => ({
    name: user?.name ?? "", email: user?.email ?? "", currency: user?.currency ?? "BRL", alert_days_before: user?.alert_days_before ?? 3,
    partner_name: user?.partner_name ?? "", together_since: user?.together_since ?? "",
  }));
  const [cute, setCute] = useCuteMode();
  const [pwd, setPwd] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pwdErrors, setPwdErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { data } = await api.put<{ user: User }>("/profile", {
        ...profile,
        partner_name: profile.partner_name.trim() || null,
        together_since: profile.together_since || null,
      });
      setUser(data.user);
      toast.success("Perfil atualizado");
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      toast.error(message);
    } finally { setSaving(false); }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdErrors({});
    try {
      await api.put("/profile/password", pwd);
      setPwd({ current_password: "", password: "", password_confirmation: "" });
      toast.success("Senha alterada");
    } catch (err) {
      const { message, fields } = parseError(err);
      setPwdErrors(fields);
      toast.error(message);
    }
  };

  const deleteAccount = async () => {
    try {
      await api.delete("/profile", { data: { password: deletePwd } });
      toast.success("Conta excluída");
      await logout();
    } catch (err) { toast.error(parseError(err).message); }
  };

  if (!user) return null;

  return (
    <>
      <PageHeader title="Meu perfil" description="Dados da conta, preferências e segurança" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2">Dados e preferências {user.role === "admin" && <Badge tone="violet">Administrador</Badge>}</span>}>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Nome" error={errors.name}><Input placeholder="Seu nome" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="E-mail" error={errors.email}><Input placeholder="voce@exemplo.com" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Moeda">
                <Select value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })}>
                  <option value="BRL">Real (R$)</option><option value="USD">Dólar (US$)</option><option value="EUR">Euro (€)</option>
                </Select>
              </Field>
              <Field label="Avisar contas com antecedência de" error={errors.alert_days_before}>
                <Select value={profile.alert_days_before} onChange={(e) => setProfile({ ...profile, alert_days_before: Number(e.target.value) })}>
                  {[0, 1, 2, 3, 5, 7, 10, 15].map((n) => <option key={n} value={n}>{n === 0 ? "No dia" : `${n} dia(s)`}</option>)}
                </Select>
              </Field>
            </div>

            {/* Nosso casal */}
            <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
                <Heart className="h-4 w-4 animate-heartbeat" /> Nosso casal
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome do seu amor" error={errors.partner_name}>
                  <Input placeholder="Ex.: Natália" value={profile.partner_name} onChange={(e) => setProfile({ ...profile, partner_name: e.target.value })} />
                </Field>
                <Field label="Juntos desde" error={errors.together_since} hint="Usamos para contar os dias e lembrar dos mesversários">
                  <DatePicker clearable placeholder="Quando começou?" value={profile.together_since} onChange={(v) => setProfile({ ...profile, together_since: v })} />
                </Field>
              </div>
            </div>

            <Button type="submit" loading={saving}>Salvar alterações</Button>
          </form>
        </Card>

        <Card title="Aparência">
          <div className="flex items-center gap-4">
            <Cat color="ginger" className="h-16 w-16 shrink-0" />
            <div className="flex-1 space-y-2">
              <Toggle checked={cute} onChange={setCute} label="Modo fofinho" />
              <p className="text-xs text-slate-500">
                Gatinhos, corações e animações pelo sistema. Fica salvo só neste dispositivo. Quem ativou “reduzir movimento” no sistema vê tudo sem animação.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Alterar senha">
          <form onSubmit={savePassword} className="space-y-4">
            <Field label="Senha atual" error={pwdErrors.current_password}><Input placeholder="Digite sua senha atual" type="password" autoComplete="current-password" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} /></Field>
            <Field label="Nova senha" error={pwdErrors.password} hint="Mínimo de 8 caracteres, com letras e números"><Input placeholder="Mínimo de 8 caracteres" type="password" autoComplete="new-password" value={pwd.password} onChange={(e) => setPwd({ ...pwd, password: e.target.value })} /></Field>
            <Field label="Confirmar nova senha"><Input placeholder="Repita a nova senha" type="password" autoComplete="new-password" value={pwd.password_confirmation} onChange={(e) => setPwd({ ...pwd, password_confirmation: e.target.value })} /></Field>
            <Button type="submit" variant="secondary">Alterar senha</Button>
          </form>
        </Card>

        <Card title="Zona de perigo" className="border-rose-200 lg:col-span-2 dark:border-rose-500/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">Excluir sua conta apaga permanentemente todos os seus lançamentos, contas, metas e orçamentos.</p>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>Excluir minha conta</Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={deleteAccount} title="Excluir conta" confirmLabel="Excluir definitivamente"
        message="Esta ação é irreversível. Digite sua senha para confirmar.">
        <Input type="password" value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} placeholder="Sua senha" />
      </ConfirmDialog>
    </>
  );
}
