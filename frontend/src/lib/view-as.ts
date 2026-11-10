"use client";

import { useSyncExternalStore } from "react";

/**
 * "Ver as finanças de outra pessoa" (somente visualização).
 *
 * Enquanto ativo, as consultas das telas financeiras levam o cabeçalho X-View-As e o
 * servidor responde com os dados da outra pessoa (se ela permitiu, no Perfil dela).
 * Vale só para esta aba: fechar o app volta para as suas próprias finanças.
 */
export type Viewing = { id: number; name: string };

const KEY = "planilha:view-as";
const EVENT = "planilha:view-as-change";

let cachedRaw: string | null | undefined;
let cached: Viewing | null = null;

function read(): Viewing | null {
  let raw: string | null = null;
  try { raw = sessionStorage.getItem(KEY); } catch { /* sem storage */ }
  if (raw === cachedRaw) return cached; // mesma referência: o useSyncExternalStore exige
  cachedRaw = raw;
  try {
    const v = raw ? JSON.parse(raw) : null;
    cached = v && typeof v.id === "number" && typeof v.name === "string" ? { id: v.id, name: v.name } : null;
  } catch {
    cached = null;
  }
  return cached;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** De quem estou vendo as finanças agora (null = as minhas). */
export const getViewing = (): Viewing | null => (typeof window === "undefined" ? null : read());

export function useViewing(): Viewing | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function setViewing(v: Viewing | null) {
  try {
    if (v) sessionStorage.setItem(KEY, JSON.stringify(v));
    else sessionStorage.removeItem(KEY);
  } catch { /* sem storage */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Telas financeiras: só nelas o "ver como" vale (perfil, avisos, pet etc. continuam sendo os meus). */
const FINANCE = /^\/?(dashboard|reports|accounts|categories|tags|transactions|budgets|goals|recurring|investments|investment-movements)(\/|\?|$)/;

export const isFinanceUrl = (url: string | undefined) => FINANCE.test(url ?? "");
