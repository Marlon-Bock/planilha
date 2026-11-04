"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/error-screen";

/** Erro inesperado ao montar uma tela: mostra uma página amigável no lugar da tela quebrada. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      cat="sleep"
      title="Algo deu errado por aqui"
      message={<>Aconteceu um erro inesperado nesta tela. Seus dados estão seguros: nada foi perdido. Tente de novo; se continuar, recarregue a página.</>}
      onRetry={reset}
      detail={error.digest}
    />
  );
}
