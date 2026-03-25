/**
 * app/api/admin/surveys/route.ts — GET lista + POST crear encuesta (Edge, protegido)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { verifyJWT, AUTH_COOKIE } from '@/lib/auth'
import type { Survey, Option } from '@/lib/types'

async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  try {
    return await verifyJWT(token)
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────────
// GET — Lista todas las encuestas (paginado)
// ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '20')))
  const offset = (page - 1) * limit

  try {
    const surveys = await sql<Survey[]>`
      SELECT id, title, description, image_url, question, is_active, close_at, created_at
      FROM surveys
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const [{ count }] = await sql<[{ count: string }]>`SELECT COUNT(*) FROM surveys`

    return NextResponse.json({ surveys, total: parseInt(count), page, limit })
  } catch (err) {
    console.error('[GET /api/admin/surveys]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────
// POST — Crear nueva encuesta
// ──────────────────────────────────────────────────
const isAllowedImageUrl = (url: string) => {
  try {
    const { hostname, protocol } = new URL(url)
    if (protocol !== 'https:') return false
    return (
      hostname.endsWith('.r2.dev') ||
      hostname.endsWith('.cloudflarestorage.com') ||
      hostname.endsWith('.supabase.co') ||
      // Soporte para dominio personalizado R2 via variable de entorno
      (process.env.R2_PUBLIC_URL ? hostname === new URL(process.env.R2_PUBLIC_URL).hostname : false)
    )
  } catch { return false }
}

const OptionInput = z.object({
  text: z.string().min(1).max(500),
  order: z.number().int().min(0),
})

const CreateSurveySchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  image_url:   z.string().url().refine(
    url => isAllowedImageUrl(url),
    { message: 'La URL de imagen debe ser de Cloudflare R2' }
  ).optional().nullable(),
  question:    z.string().min(1).max(500),
  is_active:   z.boolean().optional().default(true),
  close_at:    z.string().datetime().optional().nullable(),
  options:     z.array(OptionInput).min(2).max(10),
})

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = CreateSurveySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, description, image_url, question, is_active, close_at, options } = parsed.data

  try {
    const [survey] = await sql<Survey[]>`
      INSERT INTO surveys (title, description, image_url, question, is_active, close_at)
      VALUES (${title}, ${description ?? null}, ${image_url ?? null}, ${question}, ${is_active}, ${close_at ?? null})
      RETURNING *
    `

    const optionRows = await sql<Option[]>`
      INSERT INTO options (survey_id, text, "order")
      VALUES ${sql(options.map(o => [survey.id, o.text, o.order]))}
      RETURNING *
    `

    return NextResponse.json({ survey, options: optionRows }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/surveys]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
