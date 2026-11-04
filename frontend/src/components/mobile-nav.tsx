"use client";

/**
 * Navegação de app no celular/tablet (abaixo de 1024px), no estilo dos apps de banco:
 * barra fixa embaixo com os atalhos principais, botão "+" central e a folha "Mais".
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { ChartLine, House, LayoutGrid, LogOut, Moon, Plus, Receipt, Sun, X, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import type { AppNotification, User } from "@/lib/types";
import { usePwa } from "@/components/pwa";
import { Heart } from "@/components/cute";

export interface NavItem { href: string; label: string; icon: LucideIcon }

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function Tab({ href, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[11px] font-medium">
      <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200",
        active ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "text-slate-500 dark:text-slate-400")}>
        <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} strokeWidth={active ? 2.4 : 2} />
      </span>
      <span className={active ? "text-brand-700 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"}>{label}</span>
    </Link>
  );
}

export function BottomNav({ onNew, onMore, moreActive }: { onNew: () => void; onMore: () => void; moreActive: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-1">
        <Tab href="/dashboard" label="Início" icon={House} active={isActive(pathname, "/dashboard")} />
        <Tab href="/transacoes" label="Lançamentos" icon={Receipt} active={isActive(pathname, "/transacoes")} />
        <div className="flex flex-1 items-start justify-center">
          {/* Botão principal elevado, como nos apps de banco. */}
          <button type="button" onClick={onNew} aria-label="Novo lançamento"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/40 ring-4 ring-white transition active:scale-95 dark:ring-slate-950">
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>
        </div>
        <Tab href="/investimentos" label="Investir" icon={ChartLine} active={isActive(pathname, "/investimentos")} />
        <button type="button" onClick={onMore} aria-label="Mais opções"
          className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[11px] font-medium">
          <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-all",
            moreActive ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "text-slate-500 dark:text-slate-400")}>
            <LayoutGrid className="h-5 w-5" strokeWidth={moreActive ? 2.4 : 2} />
          </span>
          <span className={moreActive ? "text-brand-700 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"}>Mais</span>
        </button>
      </div>
    </nav>
  );
}

/** Folha que sobe de baixo, com todas as outras telas e ações. */
export function MoreSheet({ open, onClose, items, user, onLogout }: {
  open: boolean; onClose: () => void; items: NavItem[]; user: User; onLogout: () => void;
}) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { canInstall, isIOS, install } = usePwa();
  const { data: bell } = useQuery({
    queryKey: ["notifications", "bell"],
    queryFn: async () => (await api.get<{ data: AppNotification[]; unread: number }>("/notifications", { params: { per_page: 6 } })).data,
  });

  // Fecha ao navegar.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const first = (n: string) => n.trim().split(/\s+/)[0];

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
      <div className="absolute inset-0 animate-[fade-in_.2s_ease-out] bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] animate-[sheet-up_.28s_cubic-bezier(.2,.8,.2,1)] overflow-y-auto rounded-t-3xl bg-white pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-slate-900">
        <div className="sticky top-0 z-10 bg-white/95 px-5 pt-3 pb-2 backdrop-blur dark:bg-slate-900/95">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-semibold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900 dark:text-white">{user.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-brand-600 dark:text-brand-400">
                {user.partner_name ? <>{first(user.name)} <Heart className="h-3 w-3" /> {first(user.partner_name)}</> : user.email}
              </p>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            const badge = href === "/avisos" && bell?.unread ? bell.unread : 0;
            return (
              <Link key={href} href={href}
                className={cn("relative flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center text-xs font-medium transition active:scale-95",
                  active ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200")}>
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", active ? "bg-brand-600 text-white" : "bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400")}>
                  <Icon className="h-5 w-5" />
                </span>
                {label}
                {badge > 0 && <span className="absolute top-2 right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{badge > 9 ? "9+" : badge}</span>}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 space-y-1 border-t border-slate-100 px-4 pt-3 dark:border-slate-800">
          <SheetRow onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            icon={resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            label={resolvedTheme === "dark" ? "Usar tema claro" : "Usar tema escuro"} />
          {(canInstall || isIOS) && (
            <SheetRow onClick={() => { if (canInstall) void install(); else onClose(); }} icon={<Plus className="h-5 w-5" />}
              label={canInstall ? "Instalar o app neste celular" : "Instalar: Compartilhar → Tela de Início"} />
          )}
          <SheetRow onClick={onLogout} icon={<LogOut className="h-5 w-5" />} label="Sair da conta" danger />
        </div>
      </div>
    </div>
  );
}

function SheetRow({ onClick, icon, label, danger }: { onClick: () => void; icon: ReactNode; label: string; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition active:scale-[.99]",
        danger ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800")}>
      <span className="text-slate-400">{icon}</span>
      {label}
    </button>
  );
}
