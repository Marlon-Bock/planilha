import axios, { AxiosError } from "axios";
import { rememberNext } from "@/lib/navigation";

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

api.interceptors.request.use(async (config) => {
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
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (!["/login", "/cadastro"].includes(path)) {
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
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const fields: FieldErrors = {};
    for (const [k, v] of Object.entries(data?.errors ?? {})) fields[k] = v[0];
    const first = Object.values(fields)[0];
    if (!error.response) return { message: "Não foi possível conectar ao servidor.", fields };
    if (error.response.status === 429) return { message: "Muitas tentativas. Aguarde um minuto.", fields };
    return { message: first ?? data?.message ?? "Algo deu errado. Tente novamente.", fields };
  }
  return { message: "Algo deu errado. Tente novamente.", fields: {} };
}
