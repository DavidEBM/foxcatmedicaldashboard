import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Rutas públicas.
   */
  const publicRoutes = [
    "/",
    "/register",
  ];

  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  /*
   * Por ahora dejamos pasar las rutas privadas.
   *
   * Cuando conectemos Firebase agregaremos aquí
   * la validación de sesión y rol.
   */
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Ejecutar el proxy en las rutas de la aplicación,
     * excluyendo archivos estáticos y APIs.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icons).*)",
  ],
};