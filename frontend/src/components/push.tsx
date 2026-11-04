"use client";

/**
 * Notificações Web Push: chegam no celular/PC mesmo com o app fechado.
 * Funciona no Chrome/Edge/Firefox (PC e Android, inclusive no APK/TWA) e no
 * iPhone a partir do iOS 16.4, desde que o app esteja adicionado à tela de início.
 */

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellOff, BellRing, Laptop, Send, Smartphone, Trash2 } from "lucide-react";
import { api, parseError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { usePwa } from "@/components/pwa";
import { Badge, Button, Card } from "@/components/ui";

export type PushStatus = "loading" | "unsupported" | "needs-install" | "no-sw" | "denied" | "off" | "on";

interface PushInfo {
  public_key: string | null;
  enabled: boolean;
  devices: { id: number; device: string | null; last_used_at: string | null; created_at: string }[];
}

/** Converte a chave VAPID (base64url) no formato que o PushManager espera. */
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "Chrome no Android", "Edge no Windows"... para a lista de aparelhos. */
function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const app = window.matchMedia("(display-mode: standalone)").matches ? " (app instalado)" : "";
  return `${browser}${os ? ` no ${os}` : ""}${app}`;
}

/** A inscrição foi feita com esta chave pública do servidor? */
function sameKey(sub: PushSubscription, publicKey: string) {
  const current = sub.options?.applicationServerKey;
  if (!current) return true; // navegador não informa: assume que sim
  const a = new Uint8Array(current);
  const b = urlBase64ToUint8Array(publicKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function currentRegistration() {
  if (!("serviceWorker" in navigator)) return undefined;
  return navigator.serviceWorker.getRegistration("/");
}

/** Remove a inscrição deste aparelho do usuário logado (usado no logout). */
export async function detachPushFromAccount() {
  try {
    const sub = await (await currentRegistration())?.pushManager.getSubscription();
    if (sub) await api.delete("/push/subscribe", { data: { endpoint: sub.endpoint } });
  } catch { /* sem push: nada a fazer */ }
}

export function usePush() {
  const { isIOS, installed } = usePwa();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return setStatus(isIOS && !installed ? "needs-install" : "unsupported");
    if (Notification.permission === "denied") return setStatus("denied");
    const reg = await currentRegistration();
    if (!reg) return setStatus("no-sw");
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Se o servidor trocou as chaves VAPID, a inscrição antiga não funciona mais: refaz sozinho.
      const info = await api.get<PushInfo>("/push").then((r) => r.data).catch(() => null);
      if (info?.public_key && !sameKey(sub, info.public_key)) {
        await sub.unsubscribe().catch(() => {});
        sub = Notification.permission === "granted"
          ? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(info.public_key) }).catch(() => null)
          : null;
      }
    }
    if (sub) {
      // Garante que a inscrição deste aparelho está ligada à conta logada agora.
      const json = sub.toJSON();
      await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys, device: deviceLabel() }).catch(() => {});
    }
    setStatus(sub ? "on" : "off");
  }, [isIOS, installed]);

  useEffect(() => {
    // Verificação assíncrona (o estado só muda quando as promessas resolvem).
    const t = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        toast.error("Sem permissão para notificações. Libere nas configurações do navegador.");
        return;
      }
      const reg = await currentRegistration();
      if (!reg) return setStatus("no-sw");
      const { data } = await api.get<PushInfo>("/push");
      if (!data.public_key) throw new Error("O servidor ainda não tem as chaves de notificação configuradas.");
      // Inscrição antiga com outra chave impede a nova: remove antes.
      const old = await reg.pushManager.getSubscription();
      if (old && !sameKey(old, data.public_key)) await old.unsubscribe().catch(() => {});
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.public_key) });
      const json = sub.toJSON();
      await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys, device: deviceLabel() });
      setStatus("on");
      qc.invalidateQueries({ queryKey: ["push"] });
      toast.success("Notificações ativadas neste aparelho 💕");
      await api.post("/push/test").catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error && !("isAxiosError" in err) ? err.message : parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const sub = await (await currentRegistration())?.pushManager.getSubscription();
      if (sub) {
        await api.delete("/push/subscribe", { data: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setStatus("off");
      qc.invalidateQueries({ queryKey: ["push"] });
      toast.success("Notificações desativadas neste aparelho");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    try {
      const { data } = await api.post<{ sent: number }>("/push/test");
      toast.success(`Teste enviado para ${data.sent} aparelho(s). Pode fechar o app para ver chegar!`);
    } catch (err) {
      toast.error(parseError(err).message || "Nenhum aparelho com notificações ativas");
    }
  };

  return { status, busy, enable, disable, test };
}

const HELP: Partial<Record<PushStatus, string>> = {
  unsupported: "Este navegador não suporta notificações. Use Chrome, Edge ou Firefox, ou instale o app.",
  "needs-install": "No iPhone, as notificações só funcionam com o app na tela de início: toque em Compartilhar → Adicionar à Tela de Início e abra por lá.",
  "no-sw": "As notificações funcionam na versão publicada/instalada do app (não no modo de desenvolvimento).",
  denied: "As notificações foram bloqueadas para este site. Libere em: cadeado da barra de endereço → Notificações → Permitir. No celular: Configurações → Apps → Planilha → Notificações.",
};

/** Cartão de configuração (perfil). */
export function PushSettingsCard() {
  const { status, busy, enable, disable, test } = usePush();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["push"], queryFn: async () => (await api.get<PushInfo>("/push")).data });

  const removeDevice = async (id: number) => {
    await api.delete("/push/subscribe", { data: { id } });
    qc.invalidateQueries({ queryKey: ["push"] });
  };

  return (
    <Card title={<span className="flex items-center gap-2"><BellRing className="h-4 w-4 text-brand-500" /> Notificações no celular e no PC</span>} className="lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <p>Receba os avisos (contas a vencer, vencidas, orçamento estourado, metas atingidas) <strong>mesmo com o app fechado</strong>.</p>
          {HELP[status] && <p className="text-xs text-amber-700 dark:text-amber-400">{HELP[status]}</p>}
          {data && !data.enabled && <p className="text-xs text-rose-600">O servidor ainda não tem as chaves VAPID configuradas.</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {status === "on" ? (
            <>
              <Badge tone="green" className="self-center"><BellRing className="h-3 w-3" /> Ativas neste aparelho</Badge>
              <Button size="sm" variant="outline" onClick={test}><Send className="h-4 w-4" /> Enviar teste</Button>
              <Button size="sm" variant="ghost" loading={busy} onClick={disable}><BellOff className="h-4 w-4" /> Desativar</Button>
            </>
          ) : (
            <Button loading={busy || status === "loading"} disabled={status !== "off"} onClick={enable}>
              <BellRing className="h-4 w-4" /> Ativar neste aparelho
            </Button>
          )}
        </div>
      </div>

      {!!data?.devices.length && (
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-medium text-slate-500 uppercase">Aparelhos que recebem</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.devices.map((d) => (
              <li key={d.id} className="group flex items-center gap-3 py-2 text-sm">
                {/Android|iPhone/.test(d.device ?? "") ? <Smartphone className="h-4 w-4 text-slate-400" /> : <Laptop className="h-4 w-4 text-slate-400" />}
                <span className="flex-1 text-slate-700 dark:text-slate-200">{d.device ?? "Aparelho"}</span>
                <span className="text-xs text-slate-400">{d.last_used_at ? `último aviso ${fmtDate(d.last_used_at, "dd/MM HH:mm")}` : `desde ${fmtDate(d.created_at)}`}</span>
                <button onClick={() => removeDevice(d.id)} className="rounded p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600" aria-label="Remover aparelho">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Faixa discreta na tela de Avisos convidando a ativar (some quando ativo ou impossível). */
export function PushPrompt() {
  const { status, busy, enable } = usePush();
  if (status !== "off") return null;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 sm:flex-row sm:items-center sm:justify-between dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
      <span className="flex items-center gap-2"><BellRing className="h-4 w-4 shrink-0" /> Quer receber estes avisos no celular, mesmo com o app fechado?</span>
      <Button size="sm" loading={busy} onClick={enable}>Ativar notificações</Button>
    </div>
  );
}
