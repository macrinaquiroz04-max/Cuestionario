/**
 * app/api/admin/surveys/[id]/export-csv/route.ts — Exportar resultados CSV
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import redis, { SURVEY_COUNTS_KEY } from '@/lib/redis'
import { verifyJWT, AUTH_COOKIE } from '@/lib/auth'
import type { Survey, Option } from '@/lib/types'

interface RouteContext { params: { id: string } }

async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  try { return await verifyJWT(token) } catch { return null }
}

function escapeCsv(val: string | number): string {
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = params

  try {
    const [survey] = await sql<Survey[]>`SELECT * FROM surveys WHERE id = ${id}`
    if (!survey) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const options = await sql<Option[]>`
      SELECT * FROM options WHERE survey_id = ${id} ORDER BY "order" ASC
    `

    const redisHash = await redis.hgetall(SURVEY_COUNTS_KEY(id)) as Record<string, string> | null
    const counts = Object.fromEntries(
      Object.entries(redisHash ?? {}).map(([k, v]) => [k, parseInt(v)])
    )

    // Completar con BD para opciones sin datos en Redis
    const dbRows = await sql<{ option_id: string; count: string }[]>`
      SELECT option_id, COUNT(*) AS count FROM votes WHERE survey_id = ${id} GROUP BY option_id
    `
    for (const row of dbRows) {
      const dbVal = parseInt(row.count)
      counts[row.option_id] = Math.max(counts[row.option_id] ?? 0, dbVal)
    }

    const total = Object.values(counts).reduce((s, c) => s + c, 0)

    const rows = options.map(opt => {
      const count = counts[opt.id] ?? 0
      const pct = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00'
      return [escapeCsv(opt.text), escapeCsv(count), escapeCsv(`${pct}%`)].join(',')
    })

    const csv = [
      `# Encuesta: ${survey.title}`,
      `# Pregunta: ${survey.question}`,
      `# Total de votos: ${total}`,
      `# Generado: ${new Date().toISOString()}`,
      '',
      'Opción,Votos,Porcentaje',
      ...rows,
      `Total,${total},100.00%`,
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reporte-${id}.csv"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/surveys/:id/export-csv]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
