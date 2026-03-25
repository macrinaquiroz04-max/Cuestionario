# Survey Platform

Plataforma de cuestionarios y encuestas anónimas con panel de administración, diseñada para miles de votos simultáneos.

**Stack:** Next.js 14 (App Router) · Cloudflare Pages · Edge Runtime · Supabase PostgreSQL · Upstash Redis · jose JWT · Tailwind CSS · Cloudflare R2 · @react-pdf/renderer

---

## Arquitectura de votaciones concurrentes

```
Usuario vota → POST /api/votes (Edge, <10ms)
  → SETNX Redis (anti-duplicado atómico)
  → LPUSH vote_queue (cola)
  → HINCRBY survey_counts (contadores en tiempo real)
  → Respuesta 200 inmediata

Cloudflare Worker (cron cada 30s)
  → LRANGE vote_queue → bulk INSERT PostgreSQL (ON CONFLICT DO NOTHING)
```

**Sin race conditions:** SETNX es atómico. Aunque lleguen 10.000 peticiones simultáneas para la misma IP, solo una pasa.

---

## Despliegue paso a paso

### 1. Supabase — PostgreSQL

1. Crea proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta `scripts/schema.sql`
3. En **Settings → Database → Connection string**, elige **Transaction Pooler** (puerto 6543)
4. Copia la URL: `postgres://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres`

### 2. Upstash — Redis

1. Crea base de datos en [upstash.com](https://upstash.com) (región más cercana)
2. Copia `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`

### 3. Cloudflare R2 — Almacenamiento de imágenes

```bash
# Crear bucket
npx wrangler r2 bucket create survey-images

# Habilitar dominio público en el Dashboard de CF:
# Workers & Pages → R2 → survey-images → Settings → Public Access → Allow Access
```

Copia la URL pública (ej: `https://pub-HASH.r2.dev`)

Crea credenciales de API S3-compatible:
- CF Dashboard → Manage R2 API Tokens → Create API Token (Object Read & Write)
- Guarda `Access Key ID` y `Secret Access Key`

### 4. Variables de entorno

Copia `.env.local.example` a `.env.local` y completa todos los valores:

```bash
cp .env.local.example .env.local
```

| Variable | Dónde obtenerla |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Transaction Pooler |
| `VOTE_SALT` | Generar aleatorio: `openssl rand -hex 32` |
| `JWT_SECRET` | Generar aleatorio: `openssl rand -hex 64` |
| `UPSTASH_REDIS_REST_URL` | Upstash → Database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash → Database → REST API |
| `R2_ACCOUNT_ID` | CF Dashboard → Account ID (esquina superior derecha) |
| `R2_ACCESS_KEY_ID` | R2 API Token |
| `R2_SECRET_ACCESS_KEY` | R2 API Token |
| `R2_BUCKET_NAME` | `survey-images` |
| `R2_PUBLIC_URL` | URL pública del bucket R2 |
| `ADMIN_EMAIL` | Tu email de administrador |
| `ADMIN_PASSWORD` | Contraseña fuerte (mín. 12 caracteres) |
| `PDF_WORKER_URL` | URL del worker pdf-generator (después de desplegar) |

### 5. Seed — Crear administrador inicial

```bash
npm install
npm run seed
```

Esto crea el usuario admin con PBKDF2 (310.000 iteraciones, SHA-256).

### 6. Desarrollo local

```bash
npm run dev
# Abre: http://localhost:3000
# Admin: http://localhost:3000/admin/login
```

### 7. Cloudflare Workers — Vote Processor

```bash
cd workers

# Configurar secrets
npx wrangler secret put DATABASE_URL --config wrangler.vote-processor.toml
npx wrangler secret put UPSTASH_REDIS_REST_URL --config wrangler.vote-processor.toml
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN --config wrangler.vote-processor.toml

# Desplegar
npx wrangler deploy vote-processor.ts --config wrangler.vote-processor.toml
```

El worker se ejecuta automáticamente cada 30 segundos por el cron trigger.

### 8. Cloudflare Workers — PDF Generator

```bash
cd workers

# Configurar secret
npx wrangler secret put JWT_SECRET --config wrangler.pdf-generator.toml

# Desplegar (con nodejs_compat para @react-pdf/renderer)
npx wrangler deploy pdf-generator.ts --config wrangler.pdf-generator.toml
```

Copia la URL del worker (ej: `https://pdf-generator.TU_SUBDOMINIO.workers.dev`) y guárdala en `PDF_WORKER_URL`.

### 9. Cloudflare Pages — Deploy

```bash
# Instalar dependencias
npm install

# Build para Cloudflare Pages
npm run pages:build

# Desplegar
npm run pages:deploy
```

O conecta el repositorio en CF Pages Dashboard para deploys automáticos en cada push.

**Variables de entorno en CF Pages:**
1. CF Dashboard → Workers & Pages → tu-proyecto → Settings → Environment Variables
2. Agrega todas las variables del paso 4 como **Encrypted**

---

## Estructura del proyecto

```
/app
  page.tsx                          ← Home público: lista de encuestas
  /survey/[id]/
    page.tsx                        ← Página de votación (SSR)
    VoteForm.tsx                    ← Formulario de voto (Client)
  /admin/
    layout.tsx                      ← Layout con sidebar
    /login/page.tsx                 ← Login admin
    /dashboard/page.tsx             ← Métricas en tiempo real
    /surveys/
      page.tsx                      ← CRUD lista
      /new/page.tsx                 ← Crear encuesta
      /[id]/
        edit/page.tsx               ← Editar encuesta
        results/page.tsx            ← Resultados + exportar PDF/CSV

/app/api
  /votes/route.ts                   ← POST voto (SETNX + queue)
  /surveys/route.ts                 ← GET lista pública
  /surveys/[id]/route.ts            ← GET detalle público
  /admin/
    login/route.ts                  ← POST login (PBKDF2 + JWT)
    logout/route.ts                 ← POST logout
    dashboard/route.ts              ← GET métricas
    upload/route.ts                 ← POST imagen → R2
    /surveys/
      route.ts                      ← GET + POST encuestas
      /[id]/
        route.ts                    ← GET + PUT + DELETE
        results/route.ts            ← GET resultados (Redis + BD)
        export-pdf/route.ts         ← GET → delega a PDF Worker
        export-csv/route.ts         ← GET → genera CSV

/lib
  types.ts                          ← Interfaces TypeScript
  db.ts                             ← postgres.js fetch adapter
  redis.ts                          ← @upstash/redis
  auth.ts                           ← jose JWT + PBKDF2
  hash.ts                           ← SHA-256 con Web Crypto
  pdf.ts                            ← @react-pdf/renderer
  r2.ts                             ← Uploads a Cloudflare R2

/workers
  vote-processor.ts                 ← Cron Worker: queue → PostgreSQL
  pdf-generator.ts                  ← Worker: genera PDF con Node.js compat
  wrangler.vote-processor.toml
  wrangler.pdf-generator.toml

/components
  BarChart.tsx                      ← Gráfica SVG de barras
  AdminSidebar.tsx                  ← Navegación lateral
  DeleteModal.tsx                   ← Modal de confirmación
  SurveyForm.tsx                    ← Formulario crear/editar
  ImageUpload.tsx                   ← Upload de imagen a R2

/scripts
  schema.sql                        ← Schema completo PostgreSQL
  seed.ts                           ← Crea admin inicial

middleware.ts                       ← Verifica JWT en /admin/*
```

---

## Flujo de anti-duplicados

```
IP del votante
  → hashear con SHA-256 + VOTE_SALT (Web Crypto, Edge)
  → SETNX Redis: vote_lock:{surveyId}:{ipHash} (7 días)
    ├─ result = null → Ya votó → 409 Conflict
    └─ result = "OK" → Voto nuevo
         → LPUSH vote_queue
         → HINCRBY survey_counts:{surveyId} {optionId}
         → 200 OK
```

**SETNX es atómico** — Redis garantiza que aunque lleguen 10.000 requests para la misma clave simultáneamente, solo una retorna "OK".

---

## Índices en PostgreSQL

```sql
CREATE INDEX idx_votes_survey_id  ON votes(survey_id);
CREATE INDEX idx_votes_ip_hash    ON votes(ip_hash);
CREATE INDEX idx_votes_survey_ip  ON votes(survey_id, ip_hash);
CREATE INDEX idx_options_survey_id ON options(survey_id);
```

---

## Seguridad

- **Auth:** JWT HS256 con jose, cookie HttpOnly + SameSite=Strict + Secure
- **Passwords:** PBKDF2 con SHA-256, 310.000 iteraciones (NIST recomendado)
- **Comparación:** Constante en tiempo (evita timing attacks)
- **IP hashing:** SHA-256 + salt — nunca se almacena la IP real
- **Anti-enumeración:** El login responde con el mismo mensaje para email inválido y contraseña incorrecta
- **Uploads:** Validación de MIME type y tamaño máximo (5MB)
- **PDF Worker:** Verificación de secret interno (X-Internal-Secret) para evitar acceso externo
