"use client";

export function RetryButton() {
  return (
    <button onClick={() => window.location.reload()} className="h-10 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700">
      Tentar novamente
    </button>
  );
}
