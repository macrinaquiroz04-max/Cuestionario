/**
 * app/api/surveys/route.ts — GET lista de encuestas activas (público, Edge)
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import type { Survey, Option } from '@/lib/types'

export async function GET(_req: NextRequest) {
  try {
    const surveys = await sql<Survey[]>`
      SELECT id, title, description, image_url, question, is_active, close_at, created_at
      FROM surveys
      WHERE is_active = true
        AND (close_at IS NULL OR close_at > now())
      ORDER BY created_at DESC
    `

    return NextResponse.json({ surveys })
  } catch (err) {
    console.error('[GET /api/surveys]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
