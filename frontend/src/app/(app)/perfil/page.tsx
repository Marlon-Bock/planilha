"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, parseError, type FieldErrors } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuth } from "@/components/auth";
import { Badge, Button, Card, ConfirmDialog, DatePicker, Field, Input, PageHeader, Select } from "@/components/ui";
import { BUDDIES, Heart, Pet } from "@/components/cute";
import { PushSettingsCard } from "@/components/push";
import { PhotosCard } from "@/components/photos";
import { tr } from "@/lib/i18n";

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  // O AppShell só renderiza as páginas com o usuário carregado.
  const [profile, setProfile] = useState(() => ({
    name: user?.name ?? "", email: user?.email ?? "", currency: user?.currency ?? "BRL", alert_days_before: user?.alert_days_before ?? 3,
    partner_name: user?.partner_name ?? "", together_since: user?.together_since ?? "",
  }));
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
      toast.success(tr("Perfil atualizado", "Profile updated"));
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
      toast.success(tr("Senha alterada", "Password changed"));
    } catch (err) {
      const { message, fields } = parseError(err);
      setPwdErrors(fields);
      toast.error(message);
    }
  };

  const deleteAccount = async () => {
    try {
      await api.delete("/profile", { data: { password: deletePwd } });
      toast.success(tr("Conta excluída", "Account deleted"));
      await logout();
    } catch (err) { toast.error(parseError(err).message); }
  };

  if (!user) return null;

  return (
    <>
      <PageHeader title={tr("Meu perfil", "My profile")} description={tr("Dados da conta, preferências e segurança", "Account details, preferences and security")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2">{tr("Dados e preferências", "Details & preferences")} {user.role === "admin" && <Badge tone="violet">{tr("Administrador", "Administrator")}</Badge>}</span>}>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label={tr("Nome", "Name")} error={errors.name}><Input placeholder={tr("Seu nome", "Your name")} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label={tr("E-mail", "Email")} error={errors.email}><Input placeholder={tr("voce@exemplo.com", "you@example.com")} type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tr("Moeda", "Currency")}>
                <Select value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })}>
                  <option value="BRL">{tr("Real (R$)", "Brazilian real (R$)")}</option><option value="USD">{tr("Dólar (US$)", "US dollar (US$)")}</option><option value="EUR">Euro (€)</option>
                </Select>
              </Field>
              <Field label={tr("Avisar contas com antecedência de", "Alert me about bills ahead by")} error={errors.alert_days_before}>
                <Select value={profile.alert_days_before} onChange={(e) => setProfile({ ...profile, alert_days_before: Number(e.target.value) })}>
                  {[0, 1, 2, 3, 5, 7, 10, 15].map((n) => <option key={n} value={n}>{n === 0 ? tr("No dia", "On the day") : tr(`${n} dia(s)`, `${n} day(s)`)}</option>)}
                </Select>
              </Field>
            </div>

            {/* Nosso casal */}
            <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
                <Heart className="h-4 w-4 animate-heartbeat" /> {tr("Nosso casal", "Our couple")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tr("Nome do seu amor", "Your love's name")} error={errors.partner_name}>
                  <Input placeholder={tr("Ex.: Natália", "E.g. Natália")} value={profile.partner_name} onChange={(e) => setProfile({ ...profile, partner_name: e.target.value })} />
                </Field>
                <Field label={tr("Juntos desde", "Together since")} error={errors.together_since} hint={tr("Usamos para contar os dias e lembrar dos mesversários", "Used to count the days and remember your monthiversaries")}>
                  <DatePicker clearable placeholder={tr("Quando começou?", "When did it start?")} value={profile.together_since} onChange={(v) => setProfile({ ...profile, together_since: v })} />
                </Field>
              </div>
            </div>

            <Button type="submit" loading={saving}>{tr("Salvar alterações", "Save changes")}</Button>
          </form>
        </Card>

        <Card title={tr("Alterar senha", "Change password")}>
          <form onSubmit={savePassword} className="space-y-4">
            <Field label={tr("Senha atual", "Current password")} error={pwdErrors.current_password}><Input placeholder={tr("Digite sua senha atual", "Enter your current password")} type="password" autoComplete="current-password" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} /></Field>
            <Field label={tr("Nova senha", "New password")} error={pwdErrors.password} hint={tr("Mínimo de 8 caracteres, com letras e números", "At least 8 characters, with letters and numbers")}><Input placeholder={tr("Mínimo de 8 caracteres", "At least 8 characters")} type="password" autoComplete="new-password" value={pwd.password} onChange={(e) => setPwd({ ...pwd, password: e.target.value })} /></Field>
            <Field label={tr("Confirmar nova senha", "Confirm new password")}><Input placeholder={tr("Repita a nova senha", "Repeat the new password")} type="password" autoComplete="new-password" value={pwd.password_confirmation} onChange={(e) => setPwd({ ...pwd, password_confirmation: e.target.value })} /></Field>
            <Button type="submit" variant="secondary">{tr("Alterar senha", "Change password")}</Button>
          </form>
        </Card>

        <PhotosCard className="lg:col-span-2" />

        <PushSettingsCard />

        <Card title={tr("Nossos bichinhos 🐾", "Our buddies 🐾")}>
          <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-4 pt-6">
            {BUDDIES.map((b) => (
              <Pet key={`${b.kind}-${b.color}`} critter={b} className="h-16 w-16 sm:h-20 sm:w-20" />
            ))}
          </div>
          <ul className="mt-4 space-y-1 text-xs text-slate-500">
            <li><strong className="text-slate-700 dark:text-slate-300">{tr("Toque", "Tap")}</strong>{tr(" num bichinho para fazer carinho. Cinco toques seguidos fazem chover corações.", " a buddy to pet it. Five taps in a row make it rain hearts.")}</li>
            <li>{tr("O bichinho que fica no canto da tela dá para ", "You can ")}<strong className="text-slate-700 dark:text-slate-300">{tr("arrastar", "drag")}</strong>{tr(" para onde quiser. ", " the buddy in the corner of the screen anywhere you like. ")}<strong className="text-slate-700 dark:text-slate-300">{tr("Toque duas vezes", "Double-tap")}</strong>{tr(" nele para trocar de bichinho.", " it to switch buddies.")}</li>
            <li>{tr("Se ninguém brincar com ele por um tempo, ele tira uma soneca 💤", "If nobody plays with it for a while, it takes a nap 💤")}</li>
          </ul>
        </Card>

        <Card title={tr("Zona de perigo", "Danger zone")} className="border-rose-200 lg:col-span-2 dark:border-rose-500/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">{tr("Excluir sua conta apaga permanentemente todos os seus lançamentos, contas, metas e orçamentos.", "Deleting your account permanently erases all your transactions, accounts, goals and budgets.")}</p>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>{tr("Excluir minha conta", "Delete my account")}</Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={deleteAccount} title={tr("Excluir conta", "Delete account")} confirmLabel={tr("Excluir definitivamente", "Delete permanently")}
        message={tr("Esta ação é irreversível. Digite sua senha para confirmar.", "This can't be undone. Enter your password to confirm.")}>
        <Input type="password" value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} placeholder={tr("Sua senha", "Your password")} />
      </ConfirmDialog>
    </>
  );
}
