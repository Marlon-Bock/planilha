"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  ArrowLeftRight, Bell, ChartLine, ChevronsUpDown, ShieldCheck, ChartColumn, LayoutDashboard, LogOut, Moon, PiggyBank, Plus, Repeat, Sun, Tags,
  Target, UserCog, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, fmtDate, isInvestmentTx } from "@/lib/format";
import { toast } from "sonner";
import { rememberNext, resolveLink } from "@/lib/navigation";
import type { AppNotification, Transaction, User } from "@/lib/types";
import { useAuth } from "@/components/auth";
import { TransactionForm, type TxDefaults } from "@/components/transaction-form";
import { Spinner } from "@/components/ui";
import { PopoverPanel, usePopover } from "@/components/controls";
import { InstallButton } from "@/components/pwa";
import { Heart, Pet, PetBuddy } from "@/components/cute";
import { BottomNav, MoreSheet } from "@/components/mobile-nav";
import { PrivacyToggle } from "@/components/privacy";

const firstName = (n: string) => n.trim().split(/\s+/)[0];

/* ---------- Contexto para abrir o formulário de lançamento de qualquer página ---------- */

interface TxFormCtx {
  openNew: (defaults?: TxDefaults) => void;
  openEdit: (t: Transaction) => void;
}
const TxFormContext = createContext<TxFormCtx | null>(null);
export const useTxForm = () => useContext(TxFormContext)!;

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transacoes", label: "Lançamentos", icon: ArrowLeftRight },
  { href: "/contas", label: "Contas e cartões", icon: Wallet },
  { href: "/categorias", label: "Categorias e tags", icon: Tags },
  { href: "/orcamentos", label: "Orçamentos", icon: PiggyBank },
  { href: "/investimentos", label: "Investimentos", icon: ChartLine },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/recorrentes", label: "Recorrentes", icon: Repeat },
  { href: "/relatorios", label: "Relatórios", icon: ChartColumn },
  { href: "/avisos", label: "Avisos", icon: Bell },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [defaults, setDefaults] = useState<TxDefaults | undefined>();

  useEffect(() => {
    if (!loading && !user) {
      rememberNext(pathname);
      router.replace("/login");
    }
  }, [loading, user, router, pathname]);

  const openNew = useCallback((d?: TxDefaults) => {
    setEditing(null);
    setDefaults(d);
    setFormOpen(true);
  }, []);
  const openEdit = useCallback((t: Transaction) => {
    // Aplicações/resgates são controlados pelo investimento.
    if (isInvestmentTx(t.type)) {
      toast.info(`${t.type === "invest" ? "Aplicações" : "Resgates"} são editados na tela de Investimentos`);
      router.push("/investimentos");
      return;
    }
    setEditing(t);
    setFormOpen(true);
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const items = user.role === "admin" ? [...nav, { href: "/admin/usuarios", label: "Usuários", icon: Users }] : nav;

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="group flex items-center gap-2.5 px-5 py-5">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm shadow-brand-500/30">
          <Wallet className="h-5 w-5" />
          <Heart className="absolute -top-1.5 -right-1.5 h-4 w-4 text-brand-500 drop-shadow-[0_0_2px_white] animate-heartbeat dark:drop-shadow-[0_0_2px_#0f172a]" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-lg font-bold tracking-tight text-slate-900 dark:text-white">Planilha</span>
          <span className="block truncate text-xs font-medium text-brand-600 dark:text-brand-400">
            {user.partner_name ? `${firstName(user.name)} & ${firstName(user.partner_name)}` : "do casal"}
          </span>
        </span>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-slate-600 hover:bg-brand-50/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
              )}>
              <Icon className="h-4.5 w-4.5 cute:group-hover:animate-wiggle" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="relative border-t border-slate-200 p-3 dark:border-slate-800">
        {/* Gatinho e cachorrinho espiando por cima do cartão do usuário (clique = carinho). */}
        <div className="absolute -top-[42px] right-4 flex items-end gap-1">
          <Pet critter={{ kind: "dog", color: "choco" }} pose="peek" className="h-11 w-16" hearts={8} bubbleAlign="right" />
          <Pet critter={{ kind: "cat", color: "ginger" }} pose="peek" className="h-11 w-16" hearts={8} bubbleAlign="right" />
        </div>
        <UserMenu user={user} onLogout={logout} />
      </div>
    </div>
  );

  return (
    <TxFormContext.Provider value={{ openNew, openEdit }}>
      <div className="min-h-screen lg:pl-64">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">{sidebar}</aside>

        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/85">
          <div className="flex h-14 items-center gap-1 px-3 sm:px-6 lg:h-16 lg:gap-3">
            {/* Celular: marca do app à esquerda (a navegação fica na barra de baixo). */}
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2 lg:hidden">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm shadow-brand-500/30">
                <Wallet className="h-4 w-4" />
                <Heart className="absolute -top-1 -right-1 h-3.5 w-3.5 text-brand-500 drop-shadow-[0_0_2px_white] dark:drop-shadow-[0_0_2px_#0f172a]" />
              </span>
              <span className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {user.partner_name ? `${firstName(user.name)} & ${firstName(user.partner_name)}` : "Planilha"}
              </span>
            </Link>
            <div className="flex-1" />
            <InstallButton variant="ghost" className="hidden px-3 lg:inline-flex" />
            <PrivacyToggle />
            <span className="hidden lg:contents"><ThemeToggle /></span>
            <NotificationBell />
            <button onClick={() => openNew()} className="hidden h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 lg:inline-flex">
              <Plus className="h-4 w-4" /> Novo lançamento
            </button>
          </div>
        </header>

        {/* Espaço embaixo para a barra de navegação do celular. */}
        <main className="w-full px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
          <div key={pathname} className="animate-[page-in_.25s_ease-out]">{children}</div>
        </main>
      </div>

      <BottomNav onNew={() => openNew()} onMore={() => setMoreOpen(true)}
        moreActive={moreOpen || !["/dashboard", "/transacoes", "/investimentos"].some((h) => pathname.startsWith(h))} />
      <MoreSheet open={moreOpen} onClose={closeMore} user={user} onLogout={logout}
        items={[
          ...items.filter((i) => !["/dashboard", "/transacoes", "/investimentos"].includes(i.href)),
          { href: "/perfil", label: "Meu perfil", icon: UserCog },
        ]} />
      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} transaction={editing} defaults={defaults} />
      <PetBuddy />
    </TxFormContext.Provider>
  );
}

/** Cartão do usuário no rodapé da sidebar; abre um menu com perfil, admin e sair. */
function UserMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { open, setOpen, close, anchorRef, panelRef } = usePopover<HTMLButtonElement>({ matchWidth: true });
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition";

  return (
    <>
      <button ref={anchorRef} type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}
        className={cn("flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800", open && "bg-slate-100 dark:bg-slate-800")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user.name}</span>
            {user.role === "admin" && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-label="Administrador" />}
          </span>
          <span className="block truncate text-xs text-slate-500">{user.email}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <PopoverPanel panelRef={panelRef}>
          <div role="menu" className="p-1.5" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
            <div className="px-3 pt-1.5 pb-2">
              <p className="text-xs text-slate-500">Conectado como</p>
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{user.email}</p>
            </div>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <Link role="menuitem" href="/perfil" onClick={() => close(false)} className={cn(item, "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")}>
              <UserCog className="h-4 w-4 text-slate-400" /> Meu perfil
            </Link>
            {user.role === "admin" && (
              <Link role="menuitem" href="/admin/usuarios" onClick={() => close(false)} className={cn(item, "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")}>
                <Users className="h-4 w-4 text-slate-400" /> Gerenciar usuários
              </Link>
            )}
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <button role="menuitem" type="button" onClick={onLogout} className={cn(item, "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10")}>
              <LogOut className="h-4 w-4" /> Sair da conta
            </button>
          </div>
        </PopoverPanel>
      )}
    </>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Os dois ícones são renderizados e o CSS escolhe — evita divergência de hidratação.
  return (
    <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Alternar tema">
      <Sun className="hidden h-5 w-5 dark:block" />
      <Moon className="h-5 w-5 dark:hidden" />
    </button>
  );
}

const levelColor: Record<string, string> = { danger: "bg-rose-500", warning: "bg-amber-500", success: "bg-emerald-500", info: "bg-sky-500" };

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ["notifications", "bell"],
    queryFn: async () => (await api.get<{ data: AppNotification[]; unread: number }>("/notifications", { params: { per_page: 6 } })).data,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = async (n: AppNotification) => {
    setOpen(false);
    if (!n.read_at) await api.post(`/notifications/${n.id}/read`).catch(() => {});
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (n.link) router.push(resolveLink(n.link));
  };

  const unread = data?.unread ?? 0;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Avisos">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-semibold">Avisos</span>
            {unread > 0 && (
              <button className="text-xs text-brand-600 hover:underline" onClick={async () => {
                await api.post("/notifications/read-all");
                qc.invalidateQueries({ queryKey: ["notifications"] });
              }}>Marcar todos como lidos</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data?.data.length ? data.data.map((n) => (
              <button key={n.id} onClick={() => go(n)} className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800", !n.read_at && "bg-brand-50/50 dark:bg-brand-500/5")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", levelColor[n.level] ?? "bg-slate-400")} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{n.title}</span>
                  <span className="line-clamp-2 block text-xs text-slate-500">{n.message}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">{fmtDate(n.created_at, "dd/MM 'às' HH:mm")}</span>
                </span>
              </button>
            )) : <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum aviso por aqui 🎉</p>}
          </div>
          <Link href="/avisos" onClick={() => setOpen(false)} className="block border-t border-slate-100 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
            Ver todos
          </Link>
        </div>
      )}
    </div>
  );
}
