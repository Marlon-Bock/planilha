import { ChartColumn, PiggyBank, ShieldCheck, Wallet } from "lucide-react";
import { CatCouple, Heart } from "@/components/cute";

// Corações decorativos espalhados no painel (posição, tamanho e atraso fixos: render determinístico).
const FLOATING = [
  { l: "8%", t: "14%", s: 18, d: "0s" }, { l: "82%", t: "10%", s: 26, d: "1.2s" }, { l: "70%", t: "38%", s: 14, d: "2.4s" },
  { l: "14%", t: "56%", s: 22, d: "0.6s" }, { l: "88%", t: "66%", s: 18, d: "3s" }, { l: "40%", t: "84%", s: 16, d: "1.8s" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-violet-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-violet-400/30 blur-3xl" />
        {FLOATING.map((h, i) => (
          <Heart key={i} className="absolute text-white/20 animate-float-slow" style={{ left: h.l, top: h.t, width: h.s, height: h.s, animationDelay: h.d }} />
        ))}

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Wallet className="h-5 w-5" /></span>
          <span className="text-xl font-bold">Planilha <span className="font-medium text-brand-100">do casal</span></span>
        </div>

        <div className="relative space-y-8">
          <CatCouple className="-mb-2" />
          <h1 className="max-w-md text-4xl leading-tight font-bold">Nossas finanças, nossos sonhos. Juntos. 💕</h1>
          <ul className="space-y-4 text-brand-50">
            <li className="flex gap-3"><ChartColumn className="h-5 w-5 shrink-0" /> Vejam juntos para onde vai o dinheiro de vocês</li>
            <li className="flex gap-3"><PiggyBank className="h-5 w-5 shrink-0" /> Metas a dois: a viagem, a casa, o casamento...</li>
            <li className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0" /> Avisos de contas a vencer, pra ninguém se estressar</li>
          </ul>
        </div>
        <p className="relative text-sm text-brand-100">Feito com <Heart className="inline h-3.5 w-3.5 align-[-2px]" /> para organizar a vida a dois</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
