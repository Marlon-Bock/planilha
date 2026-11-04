import type { Metadata } from "next";
import { ErrorScreen } from "@/components/error-screen";

export const metadata: Metadata = { title: "Página não encontrada" };

// Vira o 404.html da exportação (servido pelo Laravel para qualquer endereço inexistente).
export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Ops! Essa página se perdeu"
      message={<>Procuramos em todo canto, até embaixo do sofá 🐾, mas ela não existe. Talvez o endereço esteja errado ou a página tenha mudado de lugar.</>}
    />
  );
}
