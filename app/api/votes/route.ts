/**
 * app/api/votes/route.ts — POST voto
 *
 * 1. SETNX en Redis → anti-duplicado atómico por IP
 * 2. INSERT directo a PostgreSQL
 * 3. HINCRBY contador en Redis → resultados en tiempo real
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import redis, { VOTE_LOCK_KEY, SURVEY_COUNTS_KEY } from '@/lib/redis'
import sql from '@/lib/db'
import { hashIP, generateSessionId } from '@/lib/hash'
import { SESSION_COOKIE, cookieOptions } from '@/lib/auth'

const VoteSchema = z.object({
  surveyId: z.string().min(1).max(100),
  optionId: z.string().min(1).max(100),
})

export async function POST(req: NextRequest) {
  // ── 1. Parsear y validar cuerpo ──────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = VoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { surveyId, optionId } = parsed.data

  // ── 2. Obtener IP real ────────────────────────────────────────────────────
  const ip =
    req.headers.get('CF-Connecting-IP') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'

  const ipHash = await hashIP(ip)

  // ── 3. Obtener/generar session ID ─────────────────────────────────────────
  let sessionId = req.cookies.get(SESSION_COOKIE)?.value
  let isNewSession = false
  if (!sessionId) {
    sessionId = generateSessionId()
    isNewSession = true
  }

  // ── 4. SETNX atómico — anti-duplicado ────────────────────────────────────
  const lockKey = VOTE_LOCK_KEY(surveyId, ipHash)
  const lockResult = await redis.set(lockKey, '1', { nx: true, ex: 604_800 })

  if (lockResult === null) {
    return NextResponse.json(
      { error: 'Ya registraste tu voto en esta encuesta', code: 'ALREADY_VOTED' },
      { status: 409 }
    )
  }

  // ── 5. INSERT directo a PostgreSQL ────────────────────────────────────────
  try {
    await sql`
      INSERT INTO votes (survey_id, option_id, ip_hash, session_id)
      VALUES (${surveyId}, ${optionId}, ${ipHash}, ${sessionId})
      ON CONFLICT (survey_id, ip_hash) DO NOTHING
    `
  } catch {
    // Revertir lock si falla el INSERT
    await redis.del(lockKey)
    return NextResponse.json({ error: 'Error al registrar voto' }, { status: 500 })
  }

  // ── 6. Incrementar contador para resultados en tiempo real ────────────────
  await redis.hincrby(SURVEY_COUNTS_KEY(surveyId), optionId, 1)

  // ── 7. Responder ──────────────────────────────────────────────────────────
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (isNewSession) {
    headers['Set-Cookie'] = `${SESSION_COOKIE}=${sessionId}; ${cookieOptions(604_800)}`
  }

  return new NextResponse(
    JSON.stringify({ ok: true, message: '¡Gracias por tu voto!' }),
    { status: 200, headers }
  )
}
