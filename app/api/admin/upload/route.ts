/**
 * app/api/admin/upload/route.ts — Upload imagen a Cloudflare R2 (Edge)
 *
 * Acepta multipart/form-data con campo "file" (imagen).
 * Retorna la URL pública del archivo subido.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT, AUTH_COOKIE } from '@/lib/auth'
import { uploadToR2 } from '@/lib/r2'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  try { return await verifyJWT(token) } catch { return null }
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Solo JPEG, PNG, WebP o GIF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Archivo muy grande. Máximo 5 MB.' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const key = `surveys/${crypto.randomUUID()}.${ext}`

    const buffer = await file.arrayBuffer()
    const publicUrl = await uploadToR2(key, buffer, file.type)

    return NextResponse.json({ url: publicUrl }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/upload]', err)
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
  }
}
