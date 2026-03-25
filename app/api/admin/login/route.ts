/**
 * app/api/admin/login/route.ts — POST login admin (Edge)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { verifyPassword, signJWT, AUTH_COOKIE, cookieOptions } from '@/lib/auth'
import redis from '@/lib/redis'
import { hashIP } from '@/lib/hash'

const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
})

const MAX_ATTEMPTS      = 5     // intentos antes de bloqueo
const WINDOW_SECONDS    = 600   // ventana de 10 minutos

export async function POST(req: NextRequest) {
  // ── Protección brute force (A07 OWASP) ─────────────────────────────────
  const clientIP =
    req.headers.get('CF-Connecting-IP') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  const ipHash      = await hashIP(clientIP)
  const rlKey       = `login_rl:${ipHash}`
  const currentAttempts = await redis.get<number>(rlKey) ?? 0

  if (currentAttempts >= MAX_ATTEMPTS) {
    const ttl = await redis.ttl(rlKey)
    return NextResponse.json(
      { error: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil((ttl > 0 ? ttl : WINDOW_SECONDS) / 60)} minutos.` },
      { status: 429, headers: { 'Retry-After': String(ttl > 0 ? ttl : WINDOW_SECONDS) } }
    )
  }
  // ───────────────────────────────────────────────────────────────────────

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 400 })
  }

  const { email, password } = parsed.data

  /** Incrementa el contador de fallos y define su expiración */
  async function recordFailure() {
    const next = await redis.incr(rlKey)
    if (next === 1) await redis.expire(rlKey, WINDOW_SECONDS)
  }

  try {
    const users = await sql<{ id: string; email: string; password_hash: string; salt: string }[]>`
      SELECT id, email, password_hash, salt
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `

    // Respuesta genérica para evitar user enumeration
    const GENERIC_ERROR = 'Email o contraseña incorrectos'

    if (users.length === 0) {
      // Hash de todas formas para evitar timing attack
      await verifyPassword(password, 'a'.repeat(64), 'dummy-salt')
      await recordFailure()
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    const user = users[0]
    const valid = await verifyPassword(password, user.password_hash, user.salt)

    if (!valid) {
      await recordFailure()
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    // Éxito → limpiar contador de intentos fallidos
    await redis.del(rlKey)

    const token = await signJWT({ sub: user.id, email: user.email })

    const response = NextResponse.json({ ok: true })
    response.headers.set(
      'Set-Cookie',
      `${AUTH_COOKIE}=${token}; ${cookieOptions(8 * 3600)}`
    )
    return response
  } catch (err) {
    console.error('[POST /api/admin/login]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
