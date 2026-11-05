"use client";

import { tr } from "@/lib/i18n";
import { RetryButton } from "./retry-button";

/** Conteúdo da tela sem internet (no cliente, para seguir o idioma escolhido). */
export function OfflineContent() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tr("Você está sem conexão", "You're offline")}</h1>
      <p className="max-w-sm text-sm text-slate-500">
        {tr(
          "Seus dados financeiros ficam só no servidor, por segurança. Assim que a internet voltar, é só tentar de novo.",
          "Your financial data stays only on the server, for safety. As soon as the internet is back, just try again.",
        )}
      </p>
      <RetryButton />
    </>
  );
}
