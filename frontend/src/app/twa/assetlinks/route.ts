import { connection } from "next/server";

/**
 * Digital Asset Links: prova para o Android que o APK (TWA) e este site são do
 * mesmo dono. Assim o app abre em tela cheia, sem barra de endereço.
 * Servido em /.well-known/assetlinks.json (rewrite em next.config.ts).
 *
 * Configure no ambiente de produção:
 *   TWA_PACKAGE_NAME=br.com.seudominio.planilha
 *   TWA_SHA256_FINGERPRINTS=AA:BB:...   (vários separados por vírgula: chave de upload + chave da Play Store)
 */
export async function GET() {
  await connection(); // lê as variáveis em tempo de execução, sem precisar de novo build
  const pkg = process.env.TWA_PACKAGE_NAME;
  const fingerprints = (process.env.TWA_SHA256_FINGERPRINTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const body = pkg && fingerprints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fingerprints } }]
    : [];

  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
