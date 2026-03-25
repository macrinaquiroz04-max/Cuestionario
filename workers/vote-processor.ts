/**
 * workers/vote-processor.ts — Cloudflare Worker: Queue → PostgreSQL bulk insert
 *
 * Procesa votos encolados en Redis cada 30 segundos (cron trigger).
 * Hace bulk INSERT con ON CONFLICT DO NOTHING como red de seguridad anti-duplicado.
 * Usa Upstash Redis (HTTP REST) — independiente del Redis de Render.
 *
 * Deploy:
 *   cd workers
 *   npx wrangler deploy vote-processor.ts --name vote-processor
 */

import { Redis } from '@upstash/redis/cloudflare'
// @ts-ignore — postgres.js con fetch adapter
import postgres from 'postgres'

export interface Env {
  DATABASE_URL:             string
  UPSTASH_REDIS_REST_URL:   string
  UPSTASH_REDIS_REST_TOKEN: string
}

interface QueuedVote {
  surveyId:  string
  optionId:  string
  ipHash:    string
  sessionId: string
  ts:        number
}

const VOTE_QUEUE_KEY    = 'vote_queue'
const BATCH_SIZE        = 500

export default {
  // Triggered por cron: */30 * * * * * (cada 30 segundos)
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processQueue(env))
  },

  // También expone HTTP para testing manual
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === '/process' && request.method === 'POST') {
      await processQueue(env)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('Vote Processor Worker', { status: 200 })
  },
}

async function processQueue(env: Env): Promise<void> {
  const redis = new Redis({
    url:   env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })

  // @ts-ignore — postgres.js fetch adapter (no en tipos pero funcional en Edge)
  const sql = postgres(env.DATABASE_URL, {
    // @ts-ignore
    fetch: (url: string, init: RequestInit) => fetch(url, init),
    max: 3,
    idle_timeout: 10,
    prepare: false,
  })

  try {
    // ── 1. Leer hasta BATCH_SIZE items de la cola ────────────────────────────
    const raw = await redis.lrange(VOTE_QUEUE_KEY, 0, BATCH_SIZE - 1)
    if (!raw || raw.length === 0) {
      console.log('[vote-processor] Cola vacía, nada que procesar.')
      return
    }

    console.log(`[vote-processor] Procesando ${raw.length} votos...`)

    // ── 2. Parsear votos ──────────────────────────────────────────────────────
    const votes: QueuedVote[] = []
    for (const item of raw) {
      try {
        const parsed = typeof item === 'string' ? JSON.parse(item) : item
        if (parsed.surveyId && parsed.optionId && parsed.ipHash && parsed.sessionId) {
          votes.push(parsed as QueuedVote)
        }
      } catch {
        console.warn('[vote-processor] Item inválido en cola:', item)
      }
    }

    if (votes.length === 0) {
      // Limpiar items inválidos
      await redis.ltrim(VOTE_QUEUE_KEY, raw.length, -1)
      return
    }

    // ── 3. Deduplicar en memoria (misma ip+survey en el mismo lote) ───────────
    const seen = new Set<string>()
    const uniqueVotes = votes.filter(v => {
      const key = `${v.surveyId}:${v.ipHash}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // ── 4. Bulk INSERT con ON CONFLICT DO NOTHING ────────────────────────────
    const values = uniqueVotes.map(v => ({
      survey_id:  v.surveyId,
      option_id:  v.optionId,
      ip_hash:    v.ipHash,
      session_id: v.sessionId,
      created_at: new Date(v.ts).toISOString(),
    }))

    await sql`
      INSERT INTO votes (survey_id, option_id, ip_hash, session_id, created_at)
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(values)}::jsonb)
        AS t(survey_id text, option_id text, ip_hash text, session_id text, created_at timestamptz)
      ON CONFLICT (survey_id, ip_hash) DO NOTHING
    `

    // ── 5. Eliminar items procesados de la cola ───────────────────────────────
    await redis.ltrim(VOTE_QUEUE_KEY, raw.length, -1)

    console.log(`[vote-processor] ${uniqueVotes.length} votos insertados (${votes.length - uniqueVotes.length} duplicados descartados).`)
  } catch (err) {
    console.error('[vote-processor] Error:', err)
    // No hacemos ltrim en caso de error — los votos se reintentarán
    throw err
  } finally {
    await sql.end()
  }
}
