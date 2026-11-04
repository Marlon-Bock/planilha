"use client";

import { resolveLink } from "@/lib/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CircleCheck, Info, RefreshCw, Trash2, TriangleAlert, CircleX } from "lucide-react";
import { api } from "@/lib/api";
import { cn, fmtDate } from "@/lib/format";
import type { AppNotification } from "@/lib/types";
import { Button, Card, EmptyState, PageHeader, Pagination, Select, Skeleton } from "@/components/ui";
import { PushPrompt } from "@/components/push";

const levelIcon = { danger: CircleX, warning: TriangleAlert, success: CircleCheck, info: Info };
const levelStyle = {
  danger: "bg-rose-50 text-rose-600 dark:bg-rose-500/10",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-500/10",
  success: "bg-teal-50 text-teal-600 dark:bg-teal-500/10",
  info: "bg-sky-50 text-sky-600 dark:bg-sky-500/10",
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [checking, setChecking] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "page", filter, level, page],
    queryFn: async () => (await api.get<{ data: AppNotification[]; meta: { current_page: number; last_page: number; total: number }; unread: number }>("/notifications", { params: { filter, level: level || undefined, page } })).data,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const check = async () => {
    setChecking(true);
    try {
      const { data } = await api.post<{ created: number }>("/notifications/check");
      toast[data.created ? "success" : "info"](data.created ? `${data.created} novo(s) aviso(s)` : "Nenhum aviso novo — tudo sob controle");
      refresh();
    } finally { setChecking(false); }
  };

  return (
    <>
      <PageHeader title="Avisos" description="Contas a vencer, vencidas, orçamentos estourados, metas atingidas e saldo negativo"
        actions={<>
          <Button variant="outline" onClick={check} loading={checking}><RefreshCw className="h-4 w-4" /> Verificar agora</Button>
          {!!data?.unread && <Button variant="secondary" onClick={async () => { await api.post("/notifications/read-all"); refresh(); }}>Marcar todos como lidos</Button>}
        </>} />

      <PushPrompt />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="w-auto">
          <option value="">Todos</option>
          <option value="unread">Não lidos ({data?.unread ?? 0})</option>
        </Select>
        <Select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className="w-auto">
          <option value="">Todos os tipos</option>
          <option value="danger">Críticos</option>
          <option value="warning">Atenção</option>
          <option value="success">Conquistas</option>
        </Select>
      </div>

      <Card padded={false}>
        {isLoading ? <div className="p-4"><Skeleton className="h-60" /></div> : !data?.data.length ? (
          <EmptyState icon={<Bell className="h-6 w-6" />} title="Nenhum aviso" description="Verificamos suas contas todos os dias às 7h. Você pode ajustar a antecedência dos avisos no seu perfil." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.data.map((n) => {
              const Icon = levelIcon[n.level] ?? Info;
              return (
                <li key={n.id} className={cn("group flex items-start gap-4 px-5 py-4", !n.read_at && "bg-brand-50/40 dark:bg-brand-500/5")}>
                  <span className={cn("rounded-lg p-2", levelStyle[n.level])}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                      {n.title}{!n.read_at && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="não lido" />}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{n.message}</p>
                    <div className="mt-1 flex gap-3 text-xs text-slate-400">
                      <span>{fmtDate(n.created_at, "dd/MM/yyyy 'às' HH:mm")}</span>
                      {n.link && <Link href={n.link.split("?")[0]} onClick={() => { resolveLink(n.link!); if (!n.read_at) api.post(`/notifications/${n.id}/read`).then(refresh); }} className="text-brand-600 hover:underline">Ver detalhes</Link>}
                      {!n.read_at && <button onClick={async () => { await api.post(`/notifications/${n.id}/read`); refresh(); }} className="hover:text-slate-600">Marcar como lido</button>}
                    </div>
                  </div>
                  <button onClick={async () => { await api.delete(`/notifications/${n.id}`); refresh(); }} className="rounded-md p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600" aria-label="Excluir aviso">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} />}
      </Card>
    </>
  );
}
