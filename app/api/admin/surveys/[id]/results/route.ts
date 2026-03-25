/**
 * app/api/admin/surveys/[id]/results/route.ts
 * GET resultados en tiempo real: Redis primero, sincroniza con BD cada 60s
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import redis, { SURVEY_COUNTS_KEY, SYNC_TS_KEY } from '@/lib/redis'
import { verifyJWT, AUTH_COOKIE } from '@/lib/auth'
import type { Survey, Option, OptionResult, SurveyResults } from '@/lib/types'

interface RouteContext { params: { id: string } }

const SYNC_INTERVAL_MS = 60_000

async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  try { return await verifyJWT(token) } catch { return null }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = params

  try {
    // ── 1. Cargar encuesta y opciones ────────────────────────────────────────
    const [survey] = await sql<Survey[]>`SELECT * FROM surveys WHERE id = ${id}`
    if (!survey) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const options = await sql<Option[]>`
      SELECT * FROM options WHERE survey_id = ${id} ORDER BY "order" ASC
    `

    // ── 2. Leer contadores de Redis ──────────────────────────────────────────
    const countsKey = SURVEY_COUNTS_KEY(id)
    const redisHash = await redis.hgetall(countsKey) as Record<string, string> | null

    // ── 3. Sincronizar con BD si pasaron más de 60s o no hay datos en Redis ──
    const syncKey     = SYNC_TS_KEY(id)
    const lastSync    = await redis.get<string>(syncKey)
    const needsSync   = !redisHash || !lastSync || (Date.now() - parseInt(lastSync)) > SYNC_INTERVAL_MS

    let dbCounts: Record<string, number> = {}

    if (needsSync) {
      const rows = await sql<{ option_id: string; count: string }[]>`
        SELECT option_id, COUNT(*) AS count
        FROM votes
        WHERE survey_id = ${id}
        GROUP BY option_id
      `
      for (const row of rows) {
        dbCounts[row.option_id] = parseInt(row.count)
      }

      // Reconciliar: usar el máximo entre Redis y BD (Redis puede tener votos en cola)
      const pipeline = redis.pipeline()
      for (const opt of options) {
        const redisVal = redisHash ? parseInt(redisHash[opt.id] ?? '0') : 0
        const dbVal    = dbCounts[opt.id] ?? 0
        const maxVal   = Math.max(redisVal, dbVal)
        pipeline.hset(countsKey, { [opt.id]: maxVal })
      }
      pipeline.set(syncKey, Date.now().toString(), { ex: 120 })
      await pipeline.exec()

      // Actualizar redisHash con los valores reconciliados
      for (const opt of options) {
        const redisVal = redisHash ? parseInt(redisHash[opt.id] ?? '0') : 0
        const dbVal    = dbCounts[opt.id] ?? 0
        if (!dbCounts) dbCounts = {}
        dbCounts[opt.id] = Math.max(redisVal, dbVal)
      }
    }

    // ── 4. Construir resultados ───────────────────────────────────────────────
    const counts = needsSync ? dbCounts : Object.fromEntries(
      Object.entries(redisHash ?? {}).map(([k, v]) => [k, parseInt(v)])
    )

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0)

    const optionResults: OptionResult[] = options.map(opt => {
      const count = counts[opt.id] ?? 0
      return {
        ...opt,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }
    }).sort((a, b) => b.count - a.count)

    // ── 5. Último voto (de BD) ───────────────────────────────────────────────
    const [lastVoteRow] = await sql<[{ created_at: string }]>`
      SELECT created_at FROM votes WHERE survey_id = ${id} ORDER BY created_at DESC LIMIT 1
    `

    const result: SurveyResults = {
      survey,
      options: optionResults,
      total_votes: total,
      last_vote_at: lastVoteRow?.created_at ?? null,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/admin/surveys/:id/results]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
