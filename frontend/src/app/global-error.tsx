"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/error-screen";

/** Erro no próprio layout raiz (raro): precisa ter <html>/<body> próprios. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR" className="cute">
      <body className="min-h-full font-sans">
        <ErrorScreen
          code="500"
          cat="sleep"
          title="O app tropeçou"
          message={<>Algo inesperado aconteceu ao abrir o sistema. Seus dados estão seguros. Tente de novo em instantes.</>}
          onRetry={reset}
          detail={error.digest}
        />
      </body>
    </html>
  );
}
