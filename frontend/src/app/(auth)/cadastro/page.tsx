"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { parseError, type FieldErrors } from "@/lib/api";
import { useAuth } from "@/components/auth";
import { Button, Field, Input } from "@/components/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      await register(form);
      toast.success("Conta criada! Já deixamos categorias e uma carteira prontas para você.");
      router.replace("/dashboard");
    } catch (err) {
      const { message, fields } = parseError(err);
      setErrors(fields);
      if (!Object.keys(fields).length) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Criar conta</h2>
      <p className="mt-1 text-sm text-slate-500">Leva menos de um minuto.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Nome" error={errors.name}>
          <Input placeholder="Seu nome completo" required autoComplete="name" value={form.name} onChange={set("name")} invalid={!!errors.name} />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <Input placeholder="voce@exemplo.com" type="email" required autoComplete="email" value={form.email} onChange={set("email")} invalid={!!errors.email} />
        </Field>
        <Field label="Senha" error={errors.password} hint="Mínimo de 8 caracteres, com letras e números">
          <Input placeholder="Mínimo de 8 caracteres" type="password" required autoComplete="new-password" value={form.password} onChange={set("password")} invalid={!!errors.password} />
        </Field>
        <Field label="Confirmar senha">
          <Input placeholder="Repita a senha" type="password" required autoComplete="new-password" value={form.password_confirmation} onChange={set("password_confirmation")} />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>Criar conta</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Já tem conta? <Link href="/login" className="font-medium text-brand-600 hover:underline">Entrar</Link>
      </p>
    </>
  );
}
