import { NextResponse, type NextRequest } from "next/server";

// Verificação otimista: sem cookie de sessão do Laravel, nem tenta abrir as
// páginas internas. A autorização real é sempre feita pela API.
const SESSION_COOKIE = process.env.SESSION_COOKIE ?? "planilha_session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    // URL limpa (/login); a página de retorno vai num cookie temporário.
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set("planilha_next", request.nextUrl.pathname, { path: "/", maxAge: 600, sameSite: "lax" });
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/transacoes/:path*", "/contas/:path*", "/categorias/:path*", "/orcamentos/:path*", "/metas/:path*", "/recorrentes/:path*", "/relatorios/:path*", "/avisos/:path*", "/perfil/:path*", "/admin/:path*"],
};
