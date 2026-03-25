/**
 * lib/db.ts — Cliente postgres.js (Node.js, Render)
 * Usa Supabase Transaction Pooler (puerto 6543) para conexiones cortas/serverless.
 */
import postgres from 'postgres'

let _sql: ReturnType<typeof postgres> | null = null

function getSQL() {
  if (_sql) return _sql

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL no definida')

  _sql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: {
      application_name: 'vox-chiapas',
    },
    prepare: false,
  })

  return _sql
}

export const sql = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, prop) {
    const instance = getSQL()
    const val = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof val === 'function') return val.bind(instance)
    return val
  },
  apply(_target, _thisArg, args) {
    return (getSQL() as unknown as (...a: unknown[]) => unknown)(...args)
  },
}) as ReturnType<typeof postgres>

export default sql
