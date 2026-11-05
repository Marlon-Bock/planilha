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
import { tr } from "@/lib/i18n";

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
        toast.error(tr("Sem permissão para notificações. Libere nas configurações do navegador.", "No permission for notifications. Allow them in the browser settings."));
        return;
      }
      const reg = await currentRegistration();
      if (!reg) return setStatus("no-sw");
      const { data } = await api.get<PushInfo>("/push");
      if (!data.public_key) throw new Error(tr("O servidor ainda não tem as chaves de notificação configuradas.", "The server doesn't have the notification keys configured yet."));
      // Inscrição antiga com outra chave impede a nova: remove antes.
      const old = await reg.pushManager.getSubscription();
      if (old && !sameKey(old, data.public_key)) await old.unsubscribe().catch(() => {});
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.public_key) });
      const json = sub.toJSON();
      await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys, device: deviceLabel() });
      setStatus("on");
      qc.invalidateQueries({ queryKey: ["push"] });
      toast.success(tr("Notificações ativadas neste aparelho 💕", "Notifications enabled on this device 💕"));
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
      toast.success(tr("Notificações desativadas neste aparelho", "Notifications turned off on this device"));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    try {
      const { data } = await api.post<{ sent: number }>("/push/test");
      toast.success(tr(`Teste enviado para ${data.sent} aparelho(s). Pode fechar o app para ver chegar!`, `Test sent to ${data.sent} device(s). Close the app to see it arrive!`));
    } catch (err) {
      toast.error(parseError(err).message || tr("Nenhum aparelho com notificações ativas", "No device has notifications enabled"));
    }
  };

  return { status, busy, enable, disable, test };
}

const help = (): Partial<Record<PushStatus, string>> => ({
  unsupported: tr("Este navegador não suporta notificações. Use Chrome, Edge ou Firefox, ou instale o app.", "This browser doesn't support notifications. Use Chrome, Edge or Firefox, or install the app."),
  "needs-install": tr("No iPhone, as notificações só funcionam com o app na tela de início: toque em Compartilhar → Adicionar à Tela de Início e abra por lá.", "On iPhone, notifications only work with the app on the home screen: tap Share → Add to Home Screen and open it from there."),
  "no-sw": tr("As notificações funcionam na versão publicada/instalada do app (não no modo de desenvolvimento).", "Notifications work in the published/installed version of the app (not in development mode)."),
  denied: tr("As notificações foram bloqueadas para este site. Libere em: cadeado da barra de endereço → Notificações → Permitir. No celular: Configurações → Apps → Planilha → Notificações.", "Notifications are blocked for this site. Allow them in: padlock in the address bar → Notifications → Allow. On the phone: Settings → Apps → Planilha → Notifications."),
});

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
    <Card title={<span className="flex items-center gap-2"><BellRing className="h-4 w-4 text-brand-500" /> {tr("Notificações no celular e no PC", "Notifications on phone and PC")}</span>}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-start">
        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <p>{tr("Receba os avisos (contas a vencer, vencidas, orçamento estourado, metas atingidas) ", "Get alerts (bills due, overdue bills, budget exceeded, goals reached) ")}<strong>{tr("mesmo com o app fechado", "even with the app closed")}</strong>.</p>
          {help()[status] && <p className="text-xs text-amber-700 dark:text-amber-400">{help()[status]}</p>}
          {data && !data.enabled && <p className="text-xs text-rose-600">{tr("O servidor ainda não tem as chaves VAPID configuradas.", "The server doesn't have the VAPID keys configured yet.")}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {status === "on" ? (
            <>
              <Badge tone="green" className="self-center"><BellRing className="h-3 w-3" /> {tr("Ativas neste aparelho", "On for this device")}</Badge>
              <Button size="sm" variant="outline" onClick={test}><Send className="h-4 w-4" /> {tr("Enviar teste", "Send test")}</Button>
              <Button size="sm" variant="ghost" loading={busy} onClick={disable}><BellOff className="h-4 w-4" /> {tr("Desativar", "Turn off")}</Button>
            </>
          ) : (
            <Button loading={busy || status === "loading"} disabled={status !== "off"} onClick={enable}>
              <BellRing className="h-4 w-4" /> {tr("Ativar neste aparelho", "Enable on this device")}
            </Button>
          )}
        </div>
      </div>

      {!!data?.devices.length && (
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-medium text-slate-500 uppercase">{tr("Aparelhos que recebem", "Devices receiving alerts")}</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.devices.map((d) => (
              <li key={d.id} className="group flex items-center gap-3 py-2 text-sm">
                {/Android|iPhone/.test(d.device ?? "") ? <Smartphone className="h-4 w-4 text-slate-400" /> : <Laptop className="h-4 w-4 text-slate-400" />}
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{d.device ?? tr("Aparelho", "Device")}</span>
                <span className="shrink-0 text-xs text-slate-400">{d.last_used_at ? tr(`último aviso ${fmtDate(d.last_used_at, "dd/MM HH:mm")}`, `last alert ${fmtDate(d.last_used_at, "dd/MM HH:mm")}`) : tr(`desde ${fmtDate(d.created_at)}`, `since ${fmtDate(d.created_at)}`)}</span>
                <button onClick={() => removeDevice(d.id)} className="rounded p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600" aria-label={tr("Remover aparelho", "Remove device")}>
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
      <span className="flex items-center gap-2"><BellRing className="h-4 w-4 shrink-0" /> {tr("Quer receber estes avisos no celular, mesmo com o app fechado?", "Want these alerts on your phone, even with the app closed?")}</span>
      <Button size="sm" loading={busy} onClick={enable}>{tr("Ativar notificações", "Enable notifications")}</Button>
    </div>
  );
}
