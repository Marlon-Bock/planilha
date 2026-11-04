"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/format";
import { ICON_GROUPS, ICONS } from "@/components/icons";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (key: string) => void }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);

  const results = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return ICONS.filter((i) => {
      if (!words.length) return !group || i.group === group;
      // A busca ignora o grupo e procura em nome, palavras-chave, grupo e chave.
      const hay = normalize(`${i.label} ${i.tags} ${i.group} ${i.key}`);
      return words.every((w) => hay.includes(w));
    });
  }, [query, group]);

  const current = ICONS.find((i) => i.key === value);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 border-b border-slate-100 p-2 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ícone: mercado, uber, pet, luz, remédio..."
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (results[0]) onChange(results[0].key); } }}
            className="h-9 w-full rounded-lg bg-slate-50 pr-8 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:bg-slate-800 dark:text-slate-100" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {current && (
          <span className="hidden items-center gap-1.5 pr-1 text-xs text-slate-500 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}><current.Icon className="h-4 w-4" /></span>
            {current.label}
          </span>
        )}
      </div>

      {!query && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 py-1.5 dark:border-slate-800">
          {[null, ...ICON_GROUPS].map((g) => (
            <button key={g ?? "all"} type="button" onClick={() => setGroup(g)}
              className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition",
                group === g ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
              {g ?? "Todos"}
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1 overflow-y-auto p-2">
        {results.map(({ key, Icon, label }) => {
          const on = key === value;
          return (
            <button key={key} type="button" onClick={() => onChange(key)} title={label} aria-label={label} aria-pressed={on}
              className={cn("flex h-10 items-center justify-center rounded-lg transition",
                on ? "text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white")}
              style={on ? { backgroundColor: color } : undefined}>
              <Icon className="h-4.5 w-4.5" />
            </button>
          );
        })}
        {!results.length && <p className="col-span-full py-6 text-center text-sm text-slate-400">Nenhum ícone para “{query}”</p>}
      </div>
      <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400 dark:border-slate-800">
        {results.length} ícone(s){query && " · Enter escolhe o primeiro"}
      </p>
    </div>
  );
}
