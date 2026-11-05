"use client";

import { tr } from "@/lib/i18n";

export function RetryButton() {
  return (
    <button onClick={() => window.location.reload()} className="h-10 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700">
      {tr("Tentar novamente", "Try again")}
    </button>
  );
}
