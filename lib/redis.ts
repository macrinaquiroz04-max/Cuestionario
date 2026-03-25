/**
 * lib/redis.ts — Cliente ioredis (TCP, Node.js / Render)
 * Wrapper con la misma API que @upstash/redis para no cambiar los call sites.
 */
import IORedis from 'ioredis'

let _client: IORedis | null = null

function getClient(): IORedis {
  if (_client) return _client
  const url = process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL no definida')
  _client = new IORedis(url, {
    lazyConnect: false,
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
    tls: url.startsWith('rediss://') ? {} : undefined,
  })
  return _client
}

type SetOpts = { nx?: boolean; ex?: number }

// Wrapper que imita la API de @upstash/redis sobre ioredis
export const redis = {
  async set(key: string, value: string | number, opts?: SetOpts): Promise<string | null> {
    const c = getClient()
    const v = String(value)
    if (opts?.ex && opts?.nx) return c.set(key, v, 'EX', opts.ex, 'NX')
    if (opts?.ex)             return c.set(key, v, 'EX', opts.ex)
    if (opts?.nx)             return c.set(key, v, 'NX')
    return c.set(key, v)
  },
  async get<T = string>(key: string): Promise<T | null> {
    const raw = await getClient().get(key)
    if (raw === null) return null
    const n = Number(raw)
    if (!isNaN(n) && raw.trim() !== '') return n as unknown as T
    return raw as unknown as T
  },
  async del(key: string): Promise<number> {
    return getClient().del(key)
  },
  async incr(key: string): Promise<number> {
    return getClient().incr(key)
  },
  async expire(key: string, seconds: number): Promise<number> {
    return getClient().expire(key, seconds)
  },
  async ttl(key: string): Promise<number> {
    return getClient().ttl(key)
  },
  async lpush(key: string, ...values: string[]): Promise<number> {
    return getClient().lpush(key, ...values)
  },
  async hincrby(key: string, field: string, amount: number): Promise<number> {
    return getClient().hincrby(key, field, amount)
  },
  async hgetall(key: string): Promise<Record<string, string> | null> {
    const result = await getClient().hgetall(key)
    return result && Object.keys(result).length > 0 ? result : null
  },
  pipeline() {
    const pipe = getClient().pipeline()
    const wrapper = {
      hset(key: string, obj: Record<string, string | number>) {
        pipe.hset(key, obj as Record<string, string>)
        return wrapper
      },
      set(key: string, value: string | number, opts?: SetOpts) {
        if (opts?.ex) pipe.set(key, String(value), 'EX', opts.ex)
        else          pipe.set(key, String(value))
        return wrapper
      },
      async exec() {
        return pipe.exec()
      },
    }
    return wrapper
  },
}

// ============================================================
// Helpers de claves Redis para consistencia
// ============================================================

/** Hash con conteos por opción: survey_counts:{surveyId} → { optionId: count } */
export const SURVEY_COUNTS_KEY = (surveyId: string) => `survey_counts:${surveyId}`

/** Lock de voto único por persona: vote_lock:{surveyId}:{ipHash} */
export const VOTE_LOCK_KEY = (surveyId: string, ipHash: string) =>
  `vote_lock:${surveyId}:${ipHash}`

/** Cola de votos pendientes de procesamiento */
export const VOTE_QUEUE_KEY = 'vote_queue'

/** Última sincronización con BD para una encuesta */
export const SYNC_TS_KEY = (surveyId: string) => `sync_ts:${surveyId}`

export default redis
