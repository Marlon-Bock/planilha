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
import { tr } from "@/lib/i18n";

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
      toast[data.created ? "success" : "info"](data.created ? tr(`${data.created} novo(s) aviso(s)`, `${data.created} new alert(s)`) : tr("Nenhum aviso novo — tudo sob controle", "No new alerts — all under control"));
      refresh();
    } finally { setChecking(false); }
  };

  return (
    <>
      <PageHeader title={tr("Avisos", "Alerts")} description={tr("Contas a vencer, vencidas, orçamentos estourados, metas atingidas e saldo negativo", "Bills due, overdue bills, budgets exceeded, goals reached and negative balance")}
        actions={<>
          <Button variant="outline" onClick={check} loading={checking}><RefreshCw className="h-4 w-4" /> {tr("Verificar agora", "Check now")}</Button>
          {!!data?.unread && <Button variant="secondary" onClick={async () => { await api.post("/notifications/read-all"); refresh(); }}>{tr("Marcar todos como lidos", "Mark all as read")}</Button>}
        </>} />

      <PushPrompt />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="w-auto">
          <option value="">{tr("Todos", "All")}</option>
          <option value="unread">{tr("Não lidos", "Unread")} ({data?.unread ?? 0})</option>
        </Select>
        <Select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className="w-auto">
          <option value="">{tr("Todos os tipos", "All types")}</option>
          <option value="danger">{tr("Críticos", "Critical")}</option>
          <option value="warning">{tr("Atenção", "Warning")}</option>
          <option value="success">{tr("Conquistas", "Achievements")}</option>
        </Select>
      </div>

      <Card padded={false}>
        {isLoading ? <div className="p-4"><Skeleton className="h-60" /></div> : !data?.data.length ? (
          <EmptyState icon={<Bell className="h-6 w-6" />} title={tr("Nenhum aviso", "No alerts")} description={tr("Verificamos suas contas todos os dias às 7h. Você pode ajustar a antecedência dos avisos no seu perfil.", "We check your bills every day at 7am. You can adjust how early you get alerts in your profile.")} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.data.map((n) => {
              const Icon = levelIcon[n.level] ?? Info;
              return (
                <li key={n.id} className={cn("group flex items-start gap-4 px-5 py-4", !n.read_at && "bg-brand-50/40 dark:bg-brand-500/5")}>
                  <span className={cn("rounded-lg p-2", levelStyle[n.level])}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                      {n.title}{!n.read_at && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label={tr("não lido", "unread")} />}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{n.message}</p>
                    <div className="mt-1 flex gap-3 text-xs text-slate-400">
                      <span>{fmtDate(n.created_at, tr("dd/MM/yyyy 'às' HH:mm", "MM/dd/yyyy 'at' h:mm a"))}</span>
                      {n.link && <Link href={n.link.split("?")[0]} onClick={() => { resolveLink(n.link!); if (!n.read_at) api.post(`/notifications/${n.id}/read`).then(refresh); }} className="text-brand-600 hover:underline">{tr("Ver detalhes", "See details")}</Link>}
                      {!n.read_at && <button onClick={async () => { await api.post(`/notifications/${n.id}/read`); refresh(); }} className="hover:text-slate-600">{tr("Marcar como lido", "Mark as read")}</button>}
                    </div>
                  </div>
                  <button onClick={async () => { await api.delete(`/notifications/${n.id}`); refresh(); }} className="rounded-md p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600" aria-label={tr("Excluir aviso", "Delete alert")}>
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
