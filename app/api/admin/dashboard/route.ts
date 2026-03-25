/**
 * app/api/admin/dashboard/route.ts — Métricas del dashboard (Edge)
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import redis, { SURVEY_COUNTS_KEY } from '@/lib/redis'
import { verifyJWT, AUTH_COOKIE } from '@/lib/auth'
import type { DashboardMetrics } from '@/lib/types'

async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  try { return await verifyJWT(token) } catch { return null }
}

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const [votesToday] = await sql<[{ count: string }]>`
      SELECT COUNT(*) FROM votes WHERE created_at >= CURRENT_DATE
    `
    const [activeSurveys] = await sql<[{ count: string }]>`
      SELECT COUNT(*) FROM surveys WHERE is_active = true AND (close_at IS NULL OR close_at > now())
    `
    const [closedSurveys] = await sql<[{ count: string }]>`
      SELECT COUNT(*) FROM surveys WHERE is_active = false OR (close_at IS NOT NULL AND close_at <= now())
    `

    // Total de votos desde Redis (suma de todos los contadores)
    const surveys = await sql<{ id: string }[]>`SELECT id FROM surveys`
    let totalVotesRedis = 0
    for (const s of surveys) {
      const hash = await redis.hgetall(SURVEY_COUNTS_KEY(s.id)) as Record<string, string> | null
      if (hash) {
        totalVotesRedis += Object.values(hash).reduce((sum, v) => sum + parseInt(v), 0)
      }
    }

    // Fallback a BD si Redis está vacío
    let totalVotes = totalVotesRedis
    if (totalVotes === 0) {
      const [totalRow] = await sql<[{ count: string }]>`SELECT COUNT(*) FROM votes`
      totalVotes = parseInt(totalRow.count)
    }

    const metrics: DashboardMetrics = {
      total_votes:    totalVotes,
      votes_today:    parseInt(votesToday.count),
      active_surveys: parseInt(activeSurveys.count),
      closed_surveys: parseInt(closedSurveys.count),
    }

    return NextResponse.json(metrics)
  } catch (err) {
    console.error('[GET /api/admin/dashboard]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
