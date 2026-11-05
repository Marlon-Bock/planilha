"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/error-screen";
import { applyLang, tr, useStoredLang } from "@/lib/i18n";

/** Erro no próprio layout raiz (raro): precisa ter <html>/<body> próprios. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Fica fora do Providers: aplica o idioma salvo aqui mesmo.
  applyLang(useStoredLang());
  return (
    <html lang="pt-BR" className="cute">
      <body className="min-h-full font-sans">
        <ErrorScreen
          code="500"
          cat="sleep"
          title={tr("O app tropeçou", "The app tripped")}
          message={<>{tr("Algo inesperado aconteceu ao abrir o sistema. Seus dados estão seguros. Tente de novo em instantes.", "Something unexpected happened while opening the app. Your data is safe. Try again in a moment.")}</>}
          onRetry={reset}
          detail={error.digest}
        />
      </body>
    </html>
  );
}
