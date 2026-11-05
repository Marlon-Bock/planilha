"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/error-screen";
import { tr } from "@/lib/i18n";

/** Erro inesperado ao montar uma tela: mostra uma página amigável no lugar da tela quebrada. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      cat="sleep"
      title={tr("Algo deu errado por aqui", "Something went wrong here")}
      message={<>{tr("Aconteceu um erro inesperado nesta tela. Seus dados estão seguros: nada foi perdido. Tente de novo; se continuar, recarregue a página.", "An unexpected error happened on this screen. Your data is safe: nothing was lost. Try again; if it keeps happening, reload the page.")}</>}
      onRetry={reset}
      detail={error.digest}
    />
  );
}
