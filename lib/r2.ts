/**
 * lib/r2.ts — Upload de imágenes a Supabase Storage (REST API, sin SDK)
 */

const BUCKET = 'surveys'

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados')
  return { url: url.replace(/\/$/, ''), key }
}

/**
 * Sube un archivo a Supabase Storage y retorna la URL pública.
 */
export async function uploadToR2(
  filePath: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string
): Promise<string> {
  const { url, key } = getSupabaseConfig()

  const uploadUrl = `${url}/storage/v1/object/${BUCKET}/${filePath}`

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: body as BodyInit,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Error al subir imagen: ${response.status} — ${text}`)
  }

  return `${url}/storage/v1/object/public/${BUCKET}/${filePath}`
}

/**
 * Elimina un objeto de Supabase Storage.
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    const { url, key: serviceKey } = getSupabaseConfig()
    const deleteUrl = `${url}/storage/v1/object/${BUCKET}/${key}`
    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${serviceKey}` },
    })
  } catch {
    // Si no hay config, simplemente no eliminamos
  }
}

/**
 * Extrae el key a partir de la URL pública de Supabase Storage.
 */
export function keyFromURL(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return publicUrl.slice(idx + marker.length)
}
