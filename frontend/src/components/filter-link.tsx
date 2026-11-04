"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { setTxIntent, type TxIntent } from "@/lib/navigation";

/** Link para /transacoes que já abre com filtros aplicados, sem mexer na URL. */
export function TxLink({ filters, className, children }: { filters: Omit<TxIntent, "id">; className?: string; children: ReactNode }) {
  return (
    <Link href="/transacoes" onClick={() => setTxIntent(filters)} className={className}>
      {children}
    </Link>
  );
}
