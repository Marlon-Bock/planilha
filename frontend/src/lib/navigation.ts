"use client";

/**
 * Navegação sem parâmetros na URL: a barra de endereço mostra só a página
 * (ex.: /transacoes). Filtros enviados de uma tela para outra ficam num store
 * em memória, e a página de destino a ser aberta após o login fica num cookie
 * temporário.
 */

import { useSyncExternalStore } from "react";

/* ------------------ Filtros enviados para a tela de lançamentos ------------------ */

export interface TxIntent {
  id: number;
  status?: string;
  month?: string;
  category_ids?: number[];
  account_ids?: number[];
}

let intent: TxIntent | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Define os filtros que a tela de lançamentos deve aplicar ao abrir. */
export function setTxIntent(filters: Omit<TxIntent, "id">) {
  intent = { ...filters, id: ++seq };
  emit();
}

/** Chamado pela tela de lançamentos depois de aplicar os filtros. */
export function clearTxIntent(id: number) {
  if (intent?.id === id) {
    intent = null;
    emit();
  }
}

export function useTxIntent() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => intent,
    () => null,
  );
}

/**
 * Converte um link antigo com query string (ex.: avisos vindos da API, como
 * "/transacoes?status=overdue") em caminho limpo + filtros em memória.
 */
export function resolveLink(link: string): string {
  const [path, query] = link.split("?");
  if (query && path === "/transacoes") {
    const qs = new URLSearchParams(query);
    const ids = (k: string) => qs.getAll(k).concat(qs.getAll(`${k}[]`)).flatMap((v) => v.split(",")).map(Number).filter(Boolean);
    setTxIntent({
      status: qs.get("status") ?? undefined,
      month: qs.get("month") ?? undefined,
      category_ids: ids("category_ids"),
      account_ids: ids("account_ids"),
    });
  }
  return path;
}

/* ------------------------ Página de retorno após o login ------------------------ */

const NEXT_COOKIE = "planilha_next";

export function rememberNext(path: string) {
  if (!path.startsWith("/") || path.startsWith("//") || path === "/login") return;
  document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(path)}; path=/; max-age=600; samesite=lax`;
}

export function takeNext(fallback = "/dashboard"): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${NEXT_COOKIE}=([^;]*)`));
  document.cookie = `${NEXT_COOKIE}=; path=/; max-age=0`;
  const v = m ? decodeURIComponent(m[1]) : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}
