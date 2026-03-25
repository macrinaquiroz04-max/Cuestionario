/**
 * Seed script — crea el usuario administrador inicial
 * Uso: tsx scripts/seed.ts
 * Requiere: .env.local con DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import 'node:process'
import { createRequire } from 'node:module'

// Cargar variables de entorno desde .env.local
const require = createRequire(import.meta.url)
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('No se encontró .env.local')
    process.exit(1)
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL!
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!

if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Faltan variables: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD')
  process.exit(1)
}

// PBKDF2 con Web Crypto API (compatible con Edge) — mismo algoritmo que usa la app
async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: 310_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )

  const hash = [...new Uint8Array(bits)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return { hash, salt }
}

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 })

  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${ADMIN_EMAIL}`
    if (existing.length > 0) {
      console.log(`✓ El administrador ${ADMIN_EMAIL} ya existe. Actualizando contraseña...`)
      const { hash, salt } = await hashPassword(ADMIN_PASSWORD)
      await sql`
        UPDATE users
        SET password_hash = ${hash}, salt = ${salt}
        WHERE email = ${ADMIN_EMAIL}
      `
      console.log('✓ Contraseña actualizada.')
    } else {
      const { hash, salt } = await hashPassword(ADMIN_PASSWORD)
      await sql`
        INSERT INTO users (email, password_hash, salt)
        VALUES (${ADMIN_EMAIL}, ${hash}, ${salt})
      `
      console.log(`✓ Administrador creado: ${ADMIN_EMAIL}`)
    }
  } finally {
    await sql.end()
  }
}

main().catch(err => {
  console.error('Error en seed:', err)
  process.exit(1)
})
