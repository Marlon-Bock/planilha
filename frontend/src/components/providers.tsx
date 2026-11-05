"use client";

import { Fragment, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/auth";
import { PwaProvider } from "@/components/pwa";
import { CuteSync } from "@/components/cute";
import { applyLang, useStoredLang } from "@/lib/i18n";

let browserQueryClient: QueryClient | undefined;

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  });
}

function getQueryClient() {
  if (typeof window === "undefined") return makeClient();
  browserQueryClient ??= makeClient();
  return browserQueryClient;
}

/** Idioma: ao trocar, remonta as telas para todos os textos virem no idioma novo. */
function LangRoot({ children }: { children: ReactNode }) {
  const lang = useStoredLang();
  applyLang(lang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <Fragment key={lang}>{children}</Fragment>;
}

export function Providers({ children }: { children: ReactNode }) {
  // Tema claro por padrão (o escuro fica só para quem escolher no botão da lua).
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} enableColorScheme={false} disableTransitionOnChange>
      <QueryClientProvider client={getQueryClient()}>
        <PwaProvider>
          <AuthProvider><LangRoot>{children}</LangRoot></AuthProvider>
        </PwaProvider>
        <Toaster richColors position="top-center" closeButton offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }} mobileOffset={{ top: "calc(env(safe-area-inset-top) + 8px)" }} />
        <CuteSync />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
