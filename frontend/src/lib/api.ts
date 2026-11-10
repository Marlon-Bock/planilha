import axios, { AxiosError } from "axios";
import { rememberNext } from "@/lib/navigation";
import { getLang, tr } from "@/lib/i18n";
import { getViewing, isFinanceUrl, setViewing } from "@/lib/view-as";
import { toast } from "sonner";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
});

let csrfReady: Promise<unknown> | null = null;

/** Garante o cookie XSRF-TOKEN do Laravel antes de requisições que alteram dados. */
export function ensureCsrf() {
  csrfReady ??= axios.get("/sanctum/csrf-cookie", { withCredentials: true }).catch((e) => {
    csrfReady = null;
    throw e;
  });
  return csrfReady;
}

/** Tentou alterar algo enquanto só visualiza as finanças de outra pessoa. */
export class ReadOnlyError extends Error {}
const readOnlyMessage = () => tr("Você está só visualizando: aqui não dá para alterar nada.", "You're only viewing: nothing can be changed here.");

api.interceptors.request.use(async (config) => {
  config.headers.set("X-Locale", getLang()); // mensagens do servidor no idioma do app
  // Vendo as finanças de outra pessoa: as consultas vão com X-View-As; alterações nem saem daqui.
  const viewing = getViewing();
  if (viewing && isFinanceUrl(config.url)) {
    if ((config.method ?? "get").toLowerCase() !== "get") {
      toast.info(readOnlyMessage(), { id: "read-only" });
      throw new ReadOnlyError(readOnlyMessage());
    }
    config.headers.set("X-View-As", String(viewing.id));
  }
  if (config.method && config.method.toLowerCase() !== "get") await ensureCsrf();
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    // Token CSRF expirado: renova e tenta de novo uma única vez.
    const cfg = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    if (error.response?.status === 419 && cfg && !cfg._retried) {
      cfg._retried = true;
      csrfReady = null;
      await ensureCsrf();
      return api.request(cfg);
    }
    // A pessoa retirou a permissão: volta para as minhas finanças.
    if (error.response?.status === 403 && (error.response.data as { view_denied?: boolean } | undefined)?.view_denied && getViewing()) {
      setViewing(null);
      window.location.reload();
    }
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path !== "/login") {
        rememberNext(path);
        // Fora de componentes React (interceptor do axios) não há router disponível.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export type FieldErrors = Record<string, string>;

/** Extrai a mensagem principal e os erros por campo de uma resposta de erro do Laravel. */
export function parseError(error: unknown): { message: string; fields: FieldErrors } {
  if (error instanceof ReadOnlyError) return { message: error.message, fields: {} };
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const fields: FieldErrors = {};
    for (const [k, v] of Object.entries(data?.errors ?? {})) fields[k] = v[0];
    const first = Object.values(fields)[0];
    if (!error.response) return { message: tr("Não foi possível conectar ao servidor.", "Could not connect to the server."), fields };
    if (error.response.status === 429) return { message: tr("Muitas tentativas. Aguarde um minuto.", "Too many attempts. Wait a minute."), fields };
    return { message: first ?? data?.message ?? tr("Algo deu errado. Tente novamente.", "Something went wrong. Please try again."), fields };
  }
  return { message: tr("Algo deu errado. Tente novamente.", "Something went wrong. Please try again."), fields: {} };
}
