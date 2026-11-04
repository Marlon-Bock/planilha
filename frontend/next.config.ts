import type { NextConfig } from "next";

// O navegador só conversa com o Next; as chamadas /api e /sanctum são
// repassadas ao Laravel. Assim os cookies de sessão e CSRF ficam na mesma
// origem do frontend (sem CORS) e o cookie de sessão é httpOnly.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/sanctum/:path*", destination: `${BACKEND_URL}/sanctum/:path*` },
      // Verificação do app Android (TWA).
      { source: "/.well-known/assetlinks.json", destination: "/twa/assetlinks" },
    ];
  },
  async headers() {
    return [
      {
        // O service worker nunca pode ficar em cache, senão o app não recebe atualizações.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
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
};

export default nextConfig;
