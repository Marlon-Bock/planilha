"use client";

import Link from "next/link";
import { useEffect } from "react";
import { addMonths, differenceInCalendarDays, differenceInCalendarMonths, format, parseISO } from "date-fns";
import { dateLocale, intlLocale, tr } from "@/lib/i18n";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth";
import { Heart, heartRain, Pet } from "@/components/cute";
import { Avatar, COVER_DEFAULT_POSITION } from "@/components/photos";
import { cn } from "@/lib/format";

const firstName = (n: string) => n.trim().split(/\s+/)[0];

function greeting(now: Date) {
  const h = now.getHours();
  return h < 5 ? tr("Boa madrugada", "Good night") : h < 12 ? tr("Bom dia", "Good morning") : h < 18 ? tr("Boa tarde", "Good afternoon") : tr("Boa noite", "Good evening");
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
  // Com capa: foto ocupa o card todo e o texto fica por cima, em branco, sobre um degradê.
  const photo = !!user.cover_url;

  return (
    <section className={cn(
      "relative mt-11 mb-6 rounded-2xl shadow-sm sm:mt-12",
      photo
        ? "flex min-h-80 flex-col justify-end shadow-lg shadow-brand-900/10 lg:min-h-96"
        : "border border-brand-100 bg-gradient-to-r from-brand-50 via-white to-violet-50 px-5 py-4 dark:border-brand-500/20 dark:from-brand-500/10 dark:via-slate-900 dark:to-violet-500/10",
    )}>
      {photo && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={user.cover_url!} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} className="cover-zoom h-full w-full object-cover"
            style={{ objectPosition: `50% ${user.cover_position ?? COVER_DEFAULT_POSITION}%` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 via-35% to-transparent to-65%" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-900/30 to-transparent" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-black/5 ring-inset" />
        </div>
      )}

      {/* Bichinhos espiando por cima do card (clique = carinho) */}
      <div className="absolute right-3 -top-[38px] flex items-end gap-0.5 sm:right-6 sm:-top-[46px]">
        <Pet critter={{ kind: "dog", color: "caramel" }} pose="peek" className="h-10 w-[60px] sm:h-12 sm:w-[74px]" hearts={12} />
        <Pet critter={{ kind: "cat", color: "gray" }} pose="peek" className="h-10 w-[60px] sm:h-12 sm:w-[74px]" hearts={14} />
        <Heart className="mb-6 h-4 w-4 text-brand-500 animate-heartbeat sm:mb-8" />
        <Pet critter={{ kind: "cat", color: "ginger" }} pose="peek" className="h-10 w-[60px] sm:h-12 sm:w-[74px]" hearts={14} bubbleAlign="right" />
      </div>

      <div className={cn("relative flex items-center gap-3 sm:gap-4", photo ? "flex-col items-start px-4 pt-24 pb-4 sm:flex-row sm:items-center sm:px-7 sm:pb-6" : "sm:pr-48")}>
        {user.avatar_url && (
          <Avatar user={user} className={cn("h-12 w-12 sm:h-16 sm:w-16", photo ? "ring-[3px] ring-white/90 shadow-lg" : "ring-4 ring-white dark:ring-slate-900")} />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <p className={cn("font-semibold", photo ? "text-xl text-white drop-shadow sm:text-2xl" : "text-lg text-slate-900 dark:text-white")}>
            {greeting(now)}, {name}! <span aria-hidden>💕</span>
          </p>

          {info ? (
            info.isMonthiversary ? (
              <p className={cn("flex items-center gap-1.5 text-sm font-medium", photo ? "text-brand-100 drop-shadow" : "text-brand-700 dark:text-brand-300")}>
                <Sparkles className="h-4 w-4" />
                {info.isAnniversary
                  ? tr(`Feliz aniversário de namoro! ${info.years} ano${info.years > 1 ? "s" : ""} juntos com ${firstName(user.partner_name!)} 🎉`, `Happy anniversary! ${info.years} year${info.years > 1 ? "s" : ""} together with ${firstName(user.partner_name!)} 🎉`)
                  : tr(`Hoje é mesversário! ${info.months} ${info.months > 1 ? "meses" : "mês"} juntos com ${firstName(user.partner_name!)} 🎉`, `Happy monthiversary! ${info.months} month${info.months > 1 ? "s" : ""} together with ${firstName(user.partner_name!)} 🎉`)}
              </p>
            ) : (
              <p className={cn("text-sm", photo ? "text-white/90 drop-shadow" : "text-slate-600 dark:text-slate-300")}>
                {tr("Você e ", "You and ")}<strong className={photo ? "text-brand-200" : "text-brand-700 dark:text-brand-300"}>{firstName(user.partner_name!)}</strong>{tr(" estão juntos há ", " have been together for ")}
                <strong className="tabular">{info.days.toLocaleString(intlLocale())} {tr("dias", "days")}</strong>
                {info.months > 0 && <> ({info.years > 0 ? tr(`${info.years} ano${info.years > 1 ? "s" : ""} e `, `${info.years} year${info.years > 1 ? "s" : ""} and `) : ""}{info.months % 12} {info.months % 12 === 1 ? tr("mês", "month") : tr("meses", "months")})</>}.
                {" "}{info.daysToNext === 1 ? tr("Próximo mesversário é amanhã", "Next monthiversary is tomorrow") : tr(`Próximo mesversário em ${info.daysToNext} dias`, `Next monthiversary in ${info.daysToNext} days`)}
                <span className={photo ? "text-white/65" : "text-slate-400"}> · {format(info.next, tr("dd 'de' MMMM", "MMMM d"), { locale: dateLocale() })}</span>
              </p>
            )
          ) : (
            <p className={cn("text-sm", photo ? "text-white/90 drop-shadow" : "text-slate-600 dark:text-slate-300")}>
              {tr("Organizar o dinheiro a dois fica mais fácil.", "Managing money as a couple just got easier.")}{" "}
              <Link href="/perfil" className={cn("font-medium hover:underline", photo ? "text-brand-200" : "text-brand-600 dark:text-brand-400")}>{tr("Conte quem é seu amor e desde quando estão juntos →", "Tell us who your love is and since when you've been together →")}</Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
