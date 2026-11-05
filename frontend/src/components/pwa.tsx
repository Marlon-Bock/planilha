"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { tr } from "@/lib/i18n";

/* Evento não tipado pelo TypeScript (Chrome/Edge/Android). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** O navegador oferece instalação (Chrome, Edge, Android). */
  canInstall: boolean;
  /** iPhone/iPad no Safari: instalação manual pelo menu Compartilhar. */
  isIOS: boolean;
  /** Já está rodando como app instalado. */
  installed: boolean;
  install: () => Promise<void>;
}

const PwaContext = createContext<PwaState>({ canInstall: false, isIOS: false, installed: false, install: async () => {} });
export const usePwa = () => useContext(PwaContext);

const subscribeDisplay = (cb: () => void) => {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function PwaProvider({ children }: { children: ReactNode }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const installed = useSyncExternalStore(subscribeDisplay, isStandalone, () => false);
  const isIOS = useSyncExternalStore(
    () => () => {},
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent),
    () => false,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // guardamos para disparar pelo nosso botão
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      toast.success(tr("App instalado! Você já pode abrir pelo menu iniciar ou pela tela inicial.", "App installed! You can now open it from the start menu or home screen."));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Service worker: só em produção (em dev o cache atrapalha o hot reload).
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const offerUpdate = (worker: ServiceWorker) =>
      toast(tr("Nova versão disponível", "New version available"), {
        description: tr("Atualize para usar as últimas melhorias.", "Update to get the latest improvements."),
        duration: Infinity,
        action: { label: tr("Atualizar", "Update"), onClick: () => worker.postMessage("SKIP_WAITING") },
      });

    let timer: ReturnType<typeof setInterval> | undefined;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) offerUpdate(sw);
        });
      });
      // Procura atualização a cada hora enquanto o app fica aberto.
      timer = setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});

    return () => {
      clearInterval(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }, [promptEvent]);

  return (
    <PwaContext.Provider value={{ canInstall: !!promptEvent && !installed, isIOS: isIOS && !installed, installed, install }}>
      {children}
    </PwaContext.Provider>
  );
}

/** Botão "Instalar app": aparece só quando dá para instalar (ou no iPhone, com instruções). */
export function InstallButton({ className, variant = "outline" }: { className?: string; variant?: "outline" | "ghost" }) {
  const { canInstall, isIOS, install } = usePwa();
  const [iosHelp, setIosHelp] = useState(false);
  if (!canInstall && !isIOS) return null;

  return (
    <>
      <Button variant={variant} className={className} onClick={() => (canInstall ? install() : setIosHelp(true))} title={tr("Instalar o app neste dispositivo", "Install the app on this device")}>
        <Download className="h-4 w-4" /> <span className="hidden md:inline">{tr("Instalar app", "Install app")}</span>
      </Button>
      <Modal open={iosHelp} onClose={() => setIosHelp(false)} title={tr("Instalar no iPhone / iPad", "Install on iPhone / iPad")} size="sm"
        footer={<Button onClick={() => setIosHelp(false)}>{tr("Entendi", "Got it")}</Button>}>
        <ol className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"><Share className="h-4 w-4" /></span>
            <span>{tr("No Safari, toque em ", "In Safari, tap ")}<strong>{tr("Compartilhar", "Share")}</strong>{tr(" (o quadrado com a seta para cima), na barra inferior.", " (the square with the up arrow) in the bottom bar.")}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"><SquarePlus className="h-4 w-4" /></span>
            <span>{tr("Role e escolha ", "Scroll and choose ")}<strong>{tr("Adicionar à Tela de Início", "Add to Home Screen")}</strong>{tr(", depois toque em ", ", then tap ")}<strong>{tr("Adicionar", "Add")}</strong>.</span>
          </li>
        </ol>
      </Modal>
    </>
  );
}
