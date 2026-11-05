"use client";

import Link from "next/link";
import { useEffect } from "react";
import { addMonths, differenceInCalendarDays, differenceInCalendarMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth";
import { Heart, heartRain, Pet } from "@/components/cute";
import { Avatar } from "@/components/photos";
import { cn } from "@/lib/format";

const firstName = (n: string) => n.trim().split(/\s+/)[0];

function greeting(now: Date) {
  const h = now.getHours();
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Contagem do casal: dias juntos, mesversário e aniversário de namoro. */
function coupleInfo(since: string, now: Date) {
  const start = parseISO(since);
  const days = differenceInCalendarDays(now, start);
  let months = differenceInCalendarMonths(now, start);
  // addMonths ajusta datas como 31/01 → 28/02, então o mesversário "cai" no último dia do mês.
  if (addMonths(start, months) > now) months--;
  const isMonthiversary = months > 0 && differenceInCalendarDays(now, addMonths(start, months)) === 0;
  const years = Math.floor(months / 12);
  const isAnniversary = isMonthiversary && months % 12 === 0;
  const next = addMonths(start, months + 1);
  return { days, months, years, isMonthiversary, isAnniversary, daysToNext: differenceInCalendarDays(next, now), next };
}

export function CoupleGreeting() {
  const { user } = useAuth();
  const now = new Date();
  const info = user?.partner_name && user.together_since ? coupleInfo(user.together_since, now) : null;
  const celebrate = !!info?.isMonthiversary;

  // Chuva de corações no mesversário (uma vez por dia).
  useEffect(() => {
    if (!celebrate) return;
    const key = `planilha:celebrated:${format(new Date(), "yyyy-MM-dd")}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch { /* sem storage: comemora mesmo assim */ }
    const t = setTimeout(() => heartRain(44), 600);
    return () => clearTimeout(t);
  }, [celebrate]);

  if (!user) return null;
  const name = firstName(user.name);

  return (
    <section className="relative mt-11 mb-6 overflow-visible rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 via-white to-violet-50 px-5 py-4 shadow-sm sm:mt-12 dark:border-brand-500/20 dark:from-brand-500/10 dark:via-slate-900 dark:to-violet-500/10">
      {/* Bichinhos espiando por cima do card (clique = carinho) */}
      <div className="absolute right-3 -top-[38px] flex items-end gap-0.5 sm:right-6 sm:-top-[46px]">
        <Pet critter={{ kind: "dog", color: "caramel" }} pose="peek" className="h-10 w-[60px] sm:h-12 sm:w-[74px]" hearts={12} />
        <Pet critter={{ kind: "cat", color: "gray" }} pose="peek" className="h-10 w-[60px] sm:h-12 sm:w-[74px]" hearts={14} />
        <Heart className="mb-6 h-4 w-4 text-brand-500 animate-heartbeat sm:mb-8" />
        <Pet critter={{ kind: "cat", color: "ginger" }} pose="peek" className="h-10 w-[60px] sm:h-12 sm:w-[74px]" hearts={14} bubbleAlign="right" />
      </div>

      {/* Capa (foto escolhida no Perfil) */}
      {user.cover_url && (
        <div className="-mx-5 -mt-4 mb-3 h-32 overflow-hidden rounded-t-[15px] sm:h-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={user.cover_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className={cn("flex items-center gap-3", !user.cover_url && "sm:pr-48")}>
        {user.avatar_url && (
          <Avatar user={user} className={cn("h-12 w-12 ring-4 ring-white sm:h-16 sm:w-16 dark:ring-slate-900", user.cover_url && "-mt-10 self-start sm:-mt-12")} />
        )}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-lg font-semibold text-slate-900 dark:text-white">
          {greeting(now)}, {name}! <span aria-hidden>💕</span>
        </p>

        {info ? (
          info.isMonthiversary ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-300">
              <Sparkles className="h-4 w-4" />
              {info.isAnniversary
                ? `Feliz aniversário de namoro! ${info.years} ano${info.years > 1 ? "s" : ""} juntos com ${firstName(user.partner_name!)} 🎉`
                : `Hoje é mesversário! ${info.months} ${info.months > 1 ? "meses" : "mês"} juntos com ${firstName(user.partner_name!)} 🎉`}
            </p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Você e <strong className="text-brand-700 dark:text-brand-300">{firstName(user.partner_name!)}</strong> estão juntos há{" "}
              <strong className="tabular">{info.days.toLocaleString("pt-BR")} dias</strong>
              {info.months > 0 && <> ({info.years > 0 ? `${info.years} ano${info.years > 1 ? "s" : ""} e ` : ""}{info.months % 12} {info.months % 12 === 1 ? "mês" : "meses"})</>}.
              {" "}Próximo mesversário {info.daysToNext === 1 ? "é amanhã" : `em ${info.daysToNext} dias`}
              <span className="text-slate-400"> · {format(info.next, "dd 'de' MMMM", { locale: ptBR })}</span>
            </p>
          )
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Organizar o dinheiro a dois fica mais fácil.{" "}
            <Link href="/perfil" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Conte quem é seu amor e desde quando estão juntos →</Link>
          </p>
        )}
      </div>
      </div>
    </section>
  );
}
