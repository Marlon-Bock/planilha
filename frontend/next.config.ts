import type { NextConfig } from "next";

/**
 * Dois modos:
 *  - Desenvolvimento (`npm run dev`): o Next repassa /api e /sanctum ao Laravel
 *    (BACKEND_URL), assim navegador e API ficam na mesma origem.
 *  - Exportação (`npm run deploy`): gera HTML/JS/CSS estáticos que o próprio Laravel
 *    serve na hospedagem (sem Node no servidor). Mesma origem também, pois o Laravel
 *    atende a API e as páginas no mesmo domínio. Rewrites/headers não existem nesse
 *    modo: o .htaccess do Laravel faz esse papel.
 */
const isExport = process.env.NEXT_EXPORT === "1";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // cacheComponents/partialPrefetching (pré-render parcial) não existem na exportação estática.
  // O app não depende deles: os dados vêm todos por AJAX no navegador.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isExport
    ? { output: "export" as const, images: { unoptimized: true } }
    : {
        async rewrites() {
          return [
            { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
            { source: "/sanctum/:path*", destination: `${BACKEND_URL}/sanctum/:path*` },
            // Em dev o assetlinks vem do Laravel, como em produção.
            { source: "/.well-known/assetlinks.json", destination: `${BACKEND_URL}/.well-known/assetlinks.json` },
          ];
        },
        async headers() {
          return [
            {
              source: "/sw.js",
              headers: [
                { key: "Content-Type", value: "application/javascript; charset=utf-8" },
                { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
              ],
            },
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "X-Frame-Options", value: "DENY" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
