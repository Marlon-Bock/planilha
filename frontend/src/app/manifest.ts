import type { MetadataRoute } from "next";

// Manifesto do PWA: permite instalar no PC (Chrome/Edge) e no celular, e é a
// base do APK (TWA) gerado pelo Bubblewrap/PWABuilder.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Planilha do Casal",
    short_name: "Planilha",
    description: "Controle financeiro pessoal: despesas, receitas, orçamentos, metas e relatórios.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#fdf2f8",
    theme_color: "#db2777",
    categories: ["finance", "productivity", "business"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Atalhos (clique direito no ícone no PC / pressionar no Android).
    shortcuts: [
      { name: "Lançamentos", short_name: "Lançamentos", url: "/transacoes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Relatórios", short_name: "Relatórios", url: "/relatorios", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Avisos", short_name: "Avisos", url: "/avisos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
