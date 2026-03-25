/**
 * app/api/surveys/[id]/route.ts — GET detalle de encuesta pública
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import type { Survey, Option } from '@/lib/types'

interface RouteContext {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = params

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const [survey] = await sql<Survey[]>`
      SELECT id, title, description, image_url, question, is_active, close_at, created_at
      FROM surveys
      WHERE id = ${id}
        AND is_active = true
        AND (close_at IS NULL OR close_at > now())
    `

    if (!survey) {
      return NextResponse.json({ error: 'Encuesta no encontrada o inactiva' }, { status: 404 })
    }

    const options = await sql<Option[]>`
      SELECT id, survey_id, text, "order"
      FROM options
      WHERE survey_id = ${id}
      ORDER BY "order" ASC
    `

    return NextResponse.json({ survey, options })
  } catch (err) {
    console.error('[GET /api/surveys/:id]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
