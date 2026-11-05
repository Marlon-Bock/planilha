import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/error-screen";

export const metadata: Metadata = { title: "Página não encontrada" };

// Vira o 404.html da exportação (servido pelo Laravel para qualquer endereço inexistente).
export default function NotFound() {
  return <NotFoundScreen />;
}
