"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Languages } from "lucide-react";
import { parseError, type FieldErrors } from "@/lib/api";
import { getLang, setLang, tr } from "@/lib/i18n";
import { takeNext } from "@/lib/navigation";
import { useAuth } from "@/components/auth";
import { Button, Checkbox, Field, Input } from "@/components/ui";

// Página que o usuário tentou abrir antes do login (cookie temporário, não vai na URL).
const nextPath = () => takeNext("/dashboard");

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace(nextPath());
  }, [user, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setMessage("");
    try {
      // O efeito acima redireciona assim que o usuário fica disponível.
      await login(email, password, remember);
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      setMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        <button type="button" onClick={() => setLang(getLang() === "en" ? "pt-BR" : "en")}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Languages className="h-4 w-4" /> {getLang() === "en" ? "Português" : "English"}
        </button>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{tr("Entrar", "Sign in")}</h2>
      <p className="mt-1 text-sm text-slate-500">{tr("Acesse sua planilha financeira.", "Access your financial planner.")}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {message && !Object.keys(errors).length && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{message}</p>}
        <Field label={tr("E-mail", "Email")} error={errors.email}>
          <Input placeholder={tr("voce@exemplo.com", "you@example.com")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
        </Field>
        <Field label={tr("Senha", "Password")} error={errors.password}>
          <Input placeholder={tr("Sua senha", "Your password")} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Checkbox checked={remember} onChange={setRemember} label={tr("Manter conectado", "Keep me signed in")} />
        <Button type="submit" className="w-full" loading={loading}>{tr("Entrar", "Sign in")}</Button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-400">{tr("Acesso restrito 💕", "Restricted access 💕")}</p>
    </>
  );
}
