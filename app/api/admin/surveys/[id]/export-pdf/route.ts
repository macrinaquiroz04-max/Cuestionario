/**
 * app/api/admin/surveys/[id]/export-pdf/route.ts
 * Genera el PDF directamente en Next.js con @react-pdf/renderer (Node.js runtime)
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import redis, { SURVEY_COUNTS_KEY } from '@/lib/redis'
import { verifyJWT, AUTH_COOKIE } from '@/lib/auth'
import { generateSurveyPDF } from '@/lib/pdf'
import type { Survey, Option, OptionResult, SurveyResults } from '@/lib/types'

export const runtime = 'nodejs'

interface RouteContext { params: { id: string } }

async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  try { return await verifyJWT(token) } catch { return null }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = params

  try {
    const [survey] = await sql<Survey[]>`SELECT * FROM surveys WHERE id = ${id}`
    if (!survey) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const options = await sql<Option[]>`
      SELECT * FROM options WHERE survey_id = ${id} ORDER BY "order" ASC
    `

    const redisHash = await redis.hgetall(SURVEY_COUNTS_KEY(id)) as Record<string, string> | null
    const counts: Record<string, number> = Object.fromEntries(
      Object.entries(redisHash ?? {}).map(([k, v]) => [k, parseInt(v)])
    )

    const dbRows = await sql<{ option_id: string; count: string }[]>`
      SELECT option_id, COUNT(*) AS count FROM votes WHERE survey_id = ${id} GROUP BY option_id
    `
    for (const row of dbRows) {
      counts[row.option_id] = Math.max(counts[row.option_id] ?? 0, parseInt(row.count))
    }

    const total = Object.values(counts).reduce((s, c) => s + c, 0)

    const [lastVote] = await sql<[{ created_at: string }]>`
      SELECT created_at FROM votes WHERE survey_id = ${id} ORDER BY created_at DESC LIMIT 1
    `

    const optionResults: OptionResult[] = options.map(opt => ({
      ...opt,
      count: counts[opt.id] ?? 0,
      percentage: total > 0 ? ((counts[opt.id] ?? 0) / total) * 100 : 0,
    }))

    const data: SurveyResults = {
      survey,
      options: optionResults,
      total_votes: total,
      last_vote_at: lastVote?.created_at ?? null,
    }

    const pdfBuffer = await generateSurveyPDF(data)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reporte-${id}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/surveys/:id/export-pdf]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

