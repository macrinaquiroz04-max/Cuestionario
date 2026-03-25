/**
 * lib/db.ts — Cliente postgres.js (Node.js, Render)
 * Usa Supabase Transaction Pooler (puerto 6543) para conexiones cortas/serverless.
 */
import postgres from 'postgres'

let _sql: ReturnType<typeof postgres> | null = null

function getSQL(): ReturnType<typeof postgres> {
  if (_sql) return _sql
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL no definida')
  _sql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { application_name: 'vox-chiapas' },
    prepare: false,
  })
  return _sql
}

// El target del Proxy DEBE ser una función para que el apply trap funcione
const sql = new Proxy(
  ((..._args: unknown[]) => {}) as unknown as ReturnType<typeof postgres>,
  {
    get(_t, prop) {
      const db = getSQL()
      const val = (db as unknown as Record<string | symbol, unknown>)[prop]
      return typeof val === 'function' ? (val as Function).bind(db) : val
    },
    apply(_t, _this, args) {
      return (getSQL() as unknown as (...a: unknown[]) => unknown)(...args)
    },
  }
)

export { sql }
export default sql
