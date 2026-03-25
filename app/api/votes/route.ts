/**
 * app/api/votes/route.ts — POST voto (Edge, SETNX atómico + queue)
 *
 * Estrategia de escritura en dos fases:
 * 1. SETNX en Redis → garantiza exactamente un voto por IP (atómico, sin race condition)
 * 2. LPUSH a vote_queue → enqueueing para procesamiento en background
 * 3. HINCRBY contador atómico → lecturas de resultados en tiempo real
 * 4. Responder 200 inmediatamente (<10ms)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import redis, { VOTE_LOCK_KEY, VOTE_QUEUE_KEY, SURVEY_COUNTS_KEY } from '@/lib/redis'
import { hashIP, generateSessionId } from '@/lib/hash'
import { SESSION_COOKIE, cookieOptions } from '@/lib/auth'
import type { QueuedVote } from '@/lib/types'

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

  // ── 2. Obtener IP real (Cloudflare la inyecta en CF-Connecting-IP) ────────
  const ip =
    req.headers.get('CF-Connecting-IP') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'

  const ipHash = await hashIP(ip)

  // ── 3. Obtener/generar session ID (cookie anónima) ────────────────────────
  let sessionId = req.cookies.get(SESSION_COOKIE)?.value
  let isNewSession = false
  if (!sessionId) {
    sessionId = generateSessionId()
    isNewSession = true
  }

  // ── 4. SETNX atómico — anti-duplicado concurrente ────────────────────────
  // Usamos la IP hasheada como identificador primario.
  // SET NX EX 604800 (7 días) es atómico: no puede haber race condition.
  const lockKey = VOTE_LOCK_KEY(surveyId, ipHash)
  const lockResult = await redis.set(lockKey, '1', { nx: true, ex: 604_800 })

  if (lockResult === null) {
    // Ya existe la clave → el usuario ya votó
    return NextResponse.json(
      { error: 'Ya registraste tu voto en esta encuesta', code: 'ALREADY_VOTED' },
      { status: 409 }
    )
  }

  // ── 5. Segunda capa: verificar sesión en Redis ────────────────────────────
  const sessionKey = `session_vote:${surveyId}:${sessionId}`
  const sessionLock = await redis.set(sessionKey, '1', { nx: true, ex: 604_800 })
  // Ignoramos el resultado de la sesión si el IP lock ya pasó — es una capa adicional, no bloqueante.

  // ── 6. Encolar voto para procesamiento async ─────────────────────────────
  const vote: QueuedVote = { surveyId, optionId, ipHash, sessionId, ts: Date.now() }
  await redis.lpush(VOTE_QUEUE_KEY, JSON.stringify(vote))

  // ── 7. Incrementar contador atómico para resultados en tiempo real ────────
  await redis.hincrby(SURVEY_COUNTS_KEY(surveyId), optionId, 1)

  // ── 8. Responder inmediatamente ──────────────────────────────────────────
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (isNewSession) {
    headers['Set-Cookie'] = `${SESSION_COOKIE}=${sessionId}; ${cookieOptions(604_800)}`
  }

  return new NextResponse(
    JSON.stringify({ ok: true, message: '¡Gracias por tu voto!' }),
    { status: 200, headers }
  )
}
