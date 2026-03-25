/**
 * app/api/admin/logout/route.ts — POST logout admin (Edge)
 */

import { NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.headers.set(
    'Set-Cookie',
    `${AUTH_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`
  )
  return response
}
