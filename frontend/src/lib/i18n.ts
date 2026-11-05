"use client";

import { useSyncExternalStore } from "react";
import { enUS, ptBR } from "date-fns/locale";

/**
 * Idioma do app (português do Brasil ou inglês).
 *
 * Cada texto é escrito nos dois idiomas no próprio lugar: tr("Salvar", "Save").
 * Ao trocar o idioma, o Providers remonta a interface (key={lang}), então até
 * textos calculados fora de hooks pegam o idioma novo.
 */
export type Lang = "pt-BR" | "en";

const KEY = "planilha:lang";
const EVENT = "planilha:lang-change";
let current: Lang = "pt-BR";

const stored = (): Lang => {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "pt-BR";
  } catch {
    return "pt-BR";
  }
};

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Idioma salvo no aparelho (no HTML pré-gerado é sempre português). */
export function useStoredLang(): Lang {
  return useSyncExternalStore(subscribe, stored, () => "pt-BR");
}

/** Usado pelo Providers a cada render, antes de desenhar as telas. */
export function applyLang(lang: Lang) {
  current = lang;
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch { /* sem storage: vale só nesta aba */ }
  current = lang;
  window.dispatchEvent(new Event(EVENT));
}

export const getLang = () => current;
export const isEn = () => current === "en";

/** Texto no idioma atual. */
export function tr(pt: string, en: string): string {
  return current === "en" ? en : pt;
}

/** Locale para Intl (números, moedas). */
export const intlLocale = () => (current === "en" ? "en-US" : "pt-BR");

/** Locale para o date-fns (nomes de meses e dias). */
export const dateLocale = () => (current === "en" ? enUS : ptBR);
