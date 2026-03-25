/**
 * app/api/admin/surveys/[id]/route.ts — GET + PUT + DELETE (protegido)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import redis, { SURVEY_COUNTS_KEY } from '@/lib/redis'
import { verifyJWT, AUTH_COOKIE } from '@/lib/auth'
import { keyFromURL, deleteFromR2 } from '@/lib/r2'
import type { Survey, Option } from '@/lib/types'

interface RouteContext { params: { id: string } }

async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  try { return await verifyJWT(token) } catch { return null }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = params
  try {
    const [survey] = await sql<Survey[]>`SELECT * FROM surveys WHERE id = ${id}`
    if (!survey) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const options = await sql<Option[]>`
      SELECT * FROM options WHERE survey_id = ${id} ORDER BY "order" ASC
    `
    return NextResponse.json({ survey, options })
  } catch (err) {
    console.error('[GET /api/admin/surveys/:id]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

const isAllowedImageUrl = (url: string) => {
  try {
    const { hostname, protocol } = new URL(url)
    if (protocol !== 'https:') return false
    return (
      hostname.endsWith('.r2.dev') ||
      hostname.endsWith('.cloudflarestorage.com') ||
      hostname.endsWith('.supabase.co') ||
      (process.env.R2_PUBLIC_URL ? hostname === new URL(process.env.R2_PUBLIC_URL).hostname : false)
    )
  } catch { return false }
}

// ── PUT ──────────────────────────────────────────────────────────────────────
const OptionInput = z.object({
  id:    z.string().optional(),
  text:  z.string().min(1).max(500),
  order: z.number().int().min(0),
})

const UpdateSurveySchema = z.object({
  title:       z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  image_url:   z.string().url().refine(
    url => isAllowedImageUrl(url),
    { message: 'La URL de imagen debe ser de Cloudflare R2' }
  ).nullable().optional(),
  question:    z.string().min(1).max(500).optional(),
  is_active:   z.boolean().optional(),
  close_at:    z.string().datetime().nullable().optional(),
  options:     z.array(OptionInput).min(2).max(10).optional(),
})

export async function PUT(req: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = UpdateSurveySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = params
  const { title, description, image_url, question, is_active, close_at, options } = parsed.data

  try {
    const [existing] = await sql<Survey[]>`SELECT * FROM surveys WHERE id = ${id}`
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const [survey] = await sql<Survey[]>`
      UPDATE surveys SET
        title       = COALESCE(${title ?? null}, title),
        description = CASE WHEN ${description !== undefined} THEN ${description ?? null} ELSE description END,
        image_url   = CASE WHEN ${image_url !== undefined} THEN ${image_url ?? null} ELSE image_url END,
        question    = COALESCE(${question ?? null}, question),
        is_active   = COALESCE(${is_active ?? null}, is_active),
        close_at    = CASE WHEN ${close_at !== undefined} THEN ${close_at ?? null} ELSE close_at END
      WHERE id = ${id}
      RETURNING *
    `

    let updatedOptions: Option[] = []
    if (options) {
      // Reemplazar opciones: eliminar + re-insertar
      await sql`DELETE FROM options WHERE survey_id = ${id}`
      updatedOptions = await sql<Option[]>`
        INSERT INTO options (survey_id, text, "order")
        SELECT ${id}, unnested.text, unnested."order"
        FROM (VALUES ${sql(options.map(o => [id, o.text, o.order]))}) AS unnested(survey_id, text, "order")
        RETURNING *
      `
      // Limpiar contadores Redis (cambió la estructura de opciones)
      await redis.del(SURVEY_COUNTS_KEY(id))
    } else {
      updatedOptions = await sql<Option[]>`
        SELECT * FROM options WHERE survey_id = ${id} ORDER BY "order" ASC
      `
    }

    return NextResponse.json({ survey, options: updatedOptions })
  } catch (err) {
    console.error('[PUT /api/admin/surveys/:id]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  if (!(await requireAuth(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = params
  try {
    const [survey] = await sql<Survey[]>`SELECT image_url FROM surveys WHERE id = ${id}`
    if (!survey) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    // Eliminar imagen de R2 si existe
    if (survey.image_url) {
      const key = keyFromURL(survey.image_url)
      if (key) await deleteFromR2(key).catch(() => {})
    }

    // Borrado en cascada (ON DELETE CASCADE en BD)
    await sql`DELETE FROM surveys WHERE id = ${id}`

    // Limpiar Redis
    await redis.del(SURVEY_COUNTS_KEY(id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/admin/surveys/:id]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
