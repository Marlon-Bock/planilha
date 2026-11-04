"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Account, Category, Tag } from "@/lib/types";

/** Listas usadas em vários formulários/filtros, compartilhadas via cache. */
export function useAccounts(withArchived = false) {
  return useQuery({
    queryKey: ["accounts", { withArchived }],
    queryFn: async () =>
      (await api.get<{ data: Account[]; summary: { total_balance: number; projected_balance: number; credit_card_debt: number } }>("/accounts", { params: { with_archived: withArchived ? 1 : 0 } })).data,
  });
}

export function useCategories(month?: string) {
  return useQuery({
    queryKey: ["categories", { month }],
    queryFn: async () => (await api.get<{ data: Category[] }>("/categories", { params: { month } })).data.data,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => (await api.get<{ data: Tag[] }>("/tags")).data.data,
  });
}

/** Invalida tudo que depende de lançamentos (saldos, dashboard, relatórios...). */
export function useInvalidateFinance() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["transactions", "accounts", "dashboard", "reports", "budgets", "categories", "notifications", "recurring", "goals", "investments"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
}
