"use client";

/**
 * Compartilhamento entre as pessoas do sistema:
 * - ViewSwitcher / ViewingBanner: ver as finanças de quem me deu permissão (somente visualização);
 * - SharingCard (Perfil): escolher quem pode ver as minhas.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { api, parseError } from "@/lib/api";
import { cn } from "@/lib/format";
import { tr } from "@/lib/i18n";
import type { Person } from "@/lib/types";
import { setViewing, useViewing, type Viewing } from "@/lib/view-as";
import { PopoverPanel, usePopover } from "@/components/controls";
import { Card, Checkbox } from "@/components/ui";

export interface SharingInfo {
  /** Outras pessoas ativas do sistema. */
  users: Person[];
  /** Quem eu deixei ver as minhas finanças. */
  viewer_ids: number[];
  /** De quem eu posso ver as finanças. */
  can_view: Person[];
}

export function useSharing() {
  return useQuery({ queryKey: ["sharing"], queryFn: async () => (await api.get<SharingInfo>("/sharing")).data, staleTime: 60_000 });
}

const firstName = (n: string) => n.trim().split(/\s+/)[0];

/** Troca de quem estou vendo os dados: limpa o cache antes, para nada de um aparecer no outro. */
function useSwitchView() {
  const qc = useQueryClient();
  return (v: Viewing | null) => {
    qc.clear();
    setViewing(v);
  };
}

/** Botão do topo: só aparece se alguém me deu permissão para ver as finanças. */
export function ViewSwitcher() {
  const { data } = useSharing();
  const viewing = useViewing();
  const switchView = useSwitchView();
  const { open, setOpen, close, anchorRef, panelRef } = usePopover<HTMLButtonElement>();
  if (!data?.can_view.length) return null;
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800";

  return (
    <>
      <button ref={anchorRef} type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}
        aria-label={tr("Ver as finanças de outra pessoa", "View someone else's finances")} title={tr("Ver as finanças de outra pessoa", "View someone else's finances")}
        className={cn("flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800",
          viewing ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "text-slate-500 dark:text-slate-400")}>
        <Eye className="h-5 w-5" />
        {viewing && <span className="hidden max-w-24 truncate sm:inline">{firstName(viewing.name)}</span>}
      </button>
      {open && (
        <PopoverPanel panelRef={panelRef}>
          <div role="menu" className="w-64 p-1.5" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
            <p className="px-3 pt-1.5 pb-2 text-xs text-slate-500">{tr("Ver as finanças de (somente visualização)", "View the finances of (view only)")}</p>
            <button role="menuitem" type="button" className={cn(item, !viewing && "font-semibold text-brand-700 dark:text-brand-300")}
              onClick={() => { close(); if (viewing) switchView(null); }}>
              <span className="flex h-4 w-4 items-center justify-center">{!viewing && <Check className="h-4 w-4" />}</span>
              {tr("As minhas", "Mine")}
            </button>
            {data.can_view.map((p) => {
              const on = viewing?.id === p.id;
              return (
                <button key={p.id} role="menuitem" type="button" className={cn(item, on && "font-semibold text-brand-700 dark:text-brand-300")}
                  onClick={() => { close(); if (!on) switchView({ id: p.id, name: p.name }); }}>
                  <span className="flex h-4 w-4 items-center justify-center">{on && <Check className="h-4 w-4" />}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </PopoverPanel>
      )}
    </>
  );
}

/** Faixa fixa avisando que os dados na tela são de outra pessoa. */
export function ViewingBanner({ viewing }: { viewing: Viewing }) {
  const switchView = useSwitchView();
  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 lg:top-16 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-200 print:hidden">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span>{tr("Você está vendo as finanças de ", "You're viewing the finances of ")}<strong>{viewing.name}</strong>{tr(" · somente visualização", " · view only")}</span>
      </span>
      <button type="button" onClick={() => switchView(null)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-200/70 px-2.5 py-1 text-xs font-semibold hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30">
        <Undo2 className="h-3.5 w-3.5" /> {tr("Voltar para as minhas", "Back to mine")}
      </button>
    </div>
  );
}

/** Perfil: quem pode ver as minhas finanças. */
export function SharingCard({ className }: { className?: string }) {
  const { data } = useSharing();
  const qc = useQueryClient();

  const toggle = async (p: Person, allow: boolean) => {
    if (!data) return;
    const viewer_ids = allow ? [...data.viewer_ids, p.id] : data.viewer_ids.filter((id) => id !== p.id);
    try {
      const res = await api.put<SharingInfo>("/sharing", { viewer_ids });
      qc.setQueryData(["sharing"], res.data);
      toast.success(allow
        ? tr(`${firstName(p.name)} agora pode ver suas finanças`, `${firstName(p.name)} can now view your finances`)
        : tr(`${firstName(p.name)} não vê mais suas finanças`, `${firstName(p.name)} can no longer view your finances`));
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  return (
    <Card title={<span className="flex items-center gap-2"><Eye className="h-4 w-4 text-brand-500" /> {tr("Quem pode ver minhas finanças", "Who can view my finances")}</span>} className={className}>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {tr("Quem você marcar ganha um botão no topo do app para ver suas telas (lançamentos, contas, metas, investimentos, relatórios...), sem poder alterar nada.",
          "Whoever you tick gets a button at the top of the app to see your screens (transactions, accounts, goals, investments, reports...), without being able to change anything.")}
      </p>
      <div className="mt-4 space-y-3">
        {data?.users.map((p) => (
          <Checkbox key={p.id} checked={data.viewer_ids.includes(p.id)} onChange={(v) => toggle(p, v)} label={p.name} className="flex" />
        ))}
        {data && !data.users.length && <p className="text-sm text-slate-400">{tr("Ainda não há outras pessoas no sistema.", "There are no other people in the system yet.")}</p>}
      </div>
      {!!data?.can_view.length && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
          {tr("Você pode ver as finanças de: ", "You can view the finances of: ")}{data.can_view.map((p) => p.name).join(", ")}.
        </p>
      )}
    </Card>
  );
}
