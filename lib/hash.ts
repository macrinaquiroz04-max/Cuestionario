/**
 * lib/hash.ts — Hash de IP con Web Crypto API (Edge compatible, sin Node.js)
 */

/**
 * Hashea una IP con SHA-256 + salt para preservar privacidad.
 * El resultado es determinístico: la misma IP + salt siempre produce el mismo hash.
 */
export async function hashIP(ip: string): Promise<string> {
  const salt = process.env.VOTE_SALT ?? 'default-salt-change-me'
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + ':' + salt)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Genera un ID de sesión aleatorio (16 bytes hexadecimales).
 * Para uso en el cliente (cookie de sesión anónima).
 */
export function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hashea un string genérico con SHA-256 (para uso interno).
 */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
