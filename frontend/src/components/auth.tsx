"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ensureCsrf } from "@/lib/api";
import { setCurrency } from "@/lib/format";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  register: (data: { name: string; email: string; password: string; password_confirmation: string }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const setUser = useCallback((u: User | null) => {
    if (u) setCurrency(u.currency);
    setUserState(u);
  }, []);

  useEffect(() => {
    api
      .get<{ user: User }>("/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [setUser]);

  const login = async (email: string, password: string, remember: boolean) => {
    await ensureCsrf();
    const { data } = await api.post<{ user: User }>("/auth/login", { email, password, remember });
    qc.clear();
    setUser(data.user);
    return data.user;
  };

  const register = async (payload: { name: string; email: string; password: string; password_confirmation: string }) => {
    await ensureCsrf();
    const { data } = await api.post<{ user: User }>("/auth/register", payload);
    qc.clear();
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      qc.clear();
      setUser(null);
      // Limpa as páginas guardadas pelo app instalado (service worker).
      navigator.serviceWorker?.controller?.postMessage("CLEAR_PAGES");
      // Recarga completa de propósito: descarta todo o estado em memória da sessão anterior.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
