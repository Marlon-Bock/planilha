"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { parseError, type FieldErrors } from "@/lib/api";
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
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Entrar</h2>
      <p className="mt-1 text-sm text-slate-500">Acesse sua planilha financeira.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {message && !Object.keys(errors).length && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{message}</p>}
        <Field label="E-mail" error={errors.email}>
          <Input placeholder="voce@exemplo.com" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
        </Field>
        <Field label="Senha" error={errors.password}>
          <Input placeholder="Sua senha" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Checkbox checked={remember} onChange={setRemember} label="Manter conectado" />
        <Button type="submit" className="w-full" loading={loading}>Entrar</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Não tem conta? <Link href="/cadastro" className="font-medium text-brand-600 hover:underline">Criar conta grátis</Link>
      </p>
    </>
  );
}
