/**
 * lib/auth.ts — JWT con jose + PBKDF2 (Edge compatible, sin bcrypt)
 */
import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from './types'

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET no definido')
  return new TextEncoder().encode(secret)
}

// ============================================================
// JWT
// ============================================================

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getJWTSecret())
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJWTSecret(), {
    algorithms: ['HS256'],
  })
  return payload as unknown as JWTPayload
}

// ============================================================
// PBKDF2 con Web Crypto API
// ============================================================

export async function hashPassword(
  password: string,
  existingSalt?: string
): Promise<{ hash: string; salt: string }> {
  const salt =
    existingSalt ??
    [...crypto.getRandomValues(new Uint8Array(16))]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: 310_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )

  const hash = [...new Uint8Array(bits)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return { hash, salt }
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, salt)
  // Comparación de tiempo constante para evitar timing attacks
  if (hash.length !== storedHash.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i)
  }
  return diff === 0
}

// ============================================================
// Cookie helpers
// ============================================================

export const AUTH_COOKIE = 'survey_admin_token'
export const SESSION_COOKIE = 'survey_session_id'

export function cookieOptions(maxAge: number) {
  return [
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV !== 'development' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}
