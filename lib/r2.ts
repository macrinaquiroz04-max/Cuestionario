/**
 * lib/r2.ts — Upload de imágenes a Cloudflare R2 con aws4fetch (Edge compatible)
 */
import { AwsClient } from 'aws4fetch'

function getR2Client(): AwsClient {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('Variables R2 no configuradas')
  }
  return new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })
}

/**
 * Sube un archivo a R2 y retorna la URL pública.
 * @param key - Ruta dentro del bucket (ej: "surveys/abc123.jpg")
 * @param body - ArrayBuffer o Uint8Array con el contenido del archivo
 * @param contentType - MIME type del archivo
 */
export async function uploadToR2(
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string
): Promise<string> {
  const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env

  if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error('Variables R2 incompletas')
  }

  const client = getR2Client()
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`

  const response = await client.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: body as BodyInit,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Error al subir a R2: ${response.status} — ${text}`)
  }

  // Retornar URL pública
  return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
}

/**
 * Elimina un objeto de R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const { R2_ACCOUNT_ID, R2_BUCKET_NAME } = process.env
  if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME) return

  const client = getR2Client()
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`

  await client.fetch(url, { method: 'DELETE' })
}

/**
 * Extrae el key de R2 a partir de la URL pública.
 */
export function keyFromURL(publicUrl: string): string | null {
  const base = process.env.R2_PUBLIC_URL
  if (!base || !publicUrl.startsWith(base)) return null
  return publicUrl.slice(base.replace(/\/$/, '').length + 1)
}
