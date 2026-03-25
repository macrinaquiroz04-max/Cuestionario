/**
 * middleware.ts — Security headers globales + verificación JWT para /admin/*
 * Edge Runtime compatible (usa jose, sin Node.js APIs)
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export const config = {
  // Aplica a todas las rutas excepto assets estáticos
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

const PUBLIC_ADMIN_PATHS = ['/admin/login']

/**
 * Añade cabeceras de seguridad a cualquier respuesta (A05 OWASP).
 * – X-Frame-Options         → evita clickjacking
 * – X-Content-Type-Options  → evita MIME sniffing
 * – Referrer-Policy         → no filtra URL al hacer clic en enlaces externos
 * – Permissions-Policy      → deshabilita APIs de hardware innecesarias
 * – HSTS                    → fuerza HTTPS en producción
 */
function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  if (process.env.NODE_ENV !== 'development') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  return res
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Rutas del panel admin — requieren JWT ───────────────────────────────
  if (pathname.startsWith('/admin')) {
    const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some(
      p => pathname === p || pathname.startsWith(p + '/')
    )

    if (!isPublicAdminPath) {
      const token = req.cookies.get('survey_admin_token')?.value

      if (!token) {
        return applySecurityHeaders(redirectToLogin(req))
      }

      try {
        const secret = process.env.JWT_SECRET
        if (!secret) {
          console.error('JWT_SECRET no configurado')
          return applySecurityHeaders(redirectToLogin(req))
        }

        await jwtVerify(token, new TextEncoder().encode(secret), {
          algorithms: ['HS256'],
        })
      } catch {
        // Token inválido o expirado — limpiar cookie y redirigir
        const response = redirectToLogin(req)
        response.cookies.set('survey_admin_token', '', { maxAge: 0, path: '/' })
        return applySecurityHeaders(response)
      }
    }
  }

  return applySecurityHeaders(NextResponse.next())
}

function redirectToLogin(req: NextRequest): NextResponse {
  const loginUrl = new URL('/admin/login', req.url)
  loginUrl.searchParams.set('from', req.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}
