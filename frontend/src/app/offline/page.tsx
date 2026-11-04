import type { Metadata } from "next";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Sem conexão" };

// Mostrada pelo service worker quando o app é aberto sem internet.
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h.01" /><path d="M8.5 16.43a5 5 0 0 1 7 0" /><path d="M5 12.86a10 10 0 0 1 5.17-2.69" /><path d="M19 12.86a10 10 0 0 0-2-1.43" /><path d="M2 8.82a15 15 0 0 1 4.17-2.65" /><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" /><path d="m2 2 20 20" />
        </svg>
      </span>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Você está sem conexão</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Seus dados financeiros ficam só no servidor, por segurança. Assim que a internet voltar, é só tentar de novo.
      </p>
      <RetryButton />
    </main>
  );
}
