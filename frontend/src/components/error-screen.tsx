"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, House, RotateCcw } from "lucide-react";
import { burstFrom, Cat, Heart } from "@/components/cute";

// Corações decorativos de fundo (posições fixas: render determinístico).
const HEARTS = [
  { l: "10%", t: "18%", s: 18, d: "0s" }, { l: "84%", t: "14%", s: 24, d: "1.4s" }, { l: "76%", t: "70%", s: 16, d: "2.2s" },
  { l: "16%", t: "74%", s: 22, d: "0.8s" }, { l: "50%", t: "8%", s: 14, d: "3s" },
];

/**
 * Tela de erro no estilo do app: gatinho, código grande com coração no lugar do "0"
 * e ações para sair dali. Usada no 404, em erros inesperados e no erro geral.
 */
export function ErrorScreen({ code, title, message, cat = "sit", children, onRetry, detail }: {
  code: string;
  title: string;
  message: ReactNode;
  cat?: "sit" | "sleep";
  children?: ReactNode;
  onRetry?: () => void;
  detail?: string;
}) {
  const router = useRouter();
  // "404" → 4 ♥ 4 (o zero vira coração).
  const digits = code.split("").map((ch, i) =>
    ch === "0" ? <Heart key={i} className="mx-1 inline h-[0.82em] w-[0.82em] align-[-0.06em] text-brand-500 animate-heartbeat" /> : <span key={i}>{ch}</span>,
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-white to-violet-50 p-6 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950/40">
      {HEARTS.map((h, i) => (
        <Heart key={i} className="absolute text-brand-300/40 animate-float-slow dark:text-brand-500/20" style={{ left: h.l, top: h.t, width: h.s, height: h.s, animationDelay: h.d }} />
      ))}

      <div className="relative w-full max-w-lg text-center">
        <button type="button" onClick={(e) => burstFrom(e, 12)} aria-label="Gatinho" title="Carinho 💕" className="mx-auto block">
          <Cat color={cat === "sleep" ? "cream" : "ginger"} pose={cat} className="mx-auto h-28 w-32 transition-transform hover:-translate-y-1" />
        </button>

        <p className="mt-2 text-7xl font-black tracking-tight text-slate-900 sm:text-8xl dark:text-white" aria-label={code}>{digits}</p>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <div className="mx-auto mt-2 max-w-md text-slate-600 dark:text-slate-300">{message}</div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <button type="button" onClick={onRetry}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-700">
              <RotateCcw className="h-4 w-4" /> Tentar de novo
            </button>
          )}
          <Link href="/dashboard"
            className={onRetry
              ? "inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              : "inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-700"}>
            <House className="h-4 w-4" /> Ir para o início
          </Link>
          <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/dashboard"))}
            className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-600 transition hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </div>

        {children}
        {detail && <p className="mt-6 font-mono text-[11px] text-slate-400">código do erro: {detail}</p>}
      </div>
    </main>
  );
}
