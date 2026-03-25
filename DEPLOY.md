# Guía de despliegue — Vox Chiapas

Stack: **Render** (app) · **Supabase** (PostgreSQL) · **Upstash** (Redis) · **Cloudflare R2** (imágenes) · **Cloudflare Workers** (procesador de votos + generador PDF)

---

## 1. Supabase (base de datos)

1. Crear proyecto en [supabase.com](https://supabase.com) (gratis).
2. En el editor SQL ejecutar `scripts/schema.sql`.
3. Ir a **Project Settings → Database → Connection string → Transaction pooler**.  
   Copiar la URL con puerto **6543** (formato `postgres://postgres.REF:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres`).

---

## 2. Upstash Redis (rate limit + caché de votos)

1. Crear base de datos en [upstash.com](https://upstash.com) → **Redis** → región más cercana.  
   Plan **Free** (10 000 comandos/día).
2. Copiar **REST URL** y **REST Token** del dashboard.

---

## 3. Cloudflare R2 (imágenes)

1. En el dashboard de Cloudflare ir a **R2 → Create bucket** → nombre `survey-images`.
2. Activar **Public access** en el bucket y copiar la URL pública (`https://pub-HASH.r2.dev`).
3. En **My Profile → API Tokens → Create Token** → usar plantilla *R2:Edit*.  
   Copiar **Account ID**, **Access Key ID** y **Secret Access Key**.

---

## 4. Cloudflare Workers

### 4a. vote-processor (cron cada minuto)
```bash
# Editar workers/wrangler.toml con tu account_id y las vars de entorno
cd workers
npx wrangler secret put DATABASE_URL
npx wrangler secret put VOTE_SALT
npm run worker:deploy
```

### 4b. pdf-generator
```bash
cd workers
npx wrangler secret put DATABASE_URL
npx wrangler secret put PDF_WORKER_SECRET   # cadena aleatoria compartida con la app
npm run worker:pdf:deploy
```
Después de desplegar, copiar la URL del worker (ej. `https://pdf-generator.TU-USUARIO.workers.dev`).

---

## 5. Variables de entorno

Crear/completar `.env.local` (local) y configurar en Render dashboard:

```
DATABASE_URL=postgres://postgres.REF:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres
VOTE_SALT=<cadena aleatoria larga>
JWT_SECRET=<cadena aleatoria larga>
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
R2_ACCOUNT_ID=<account id cloudflare>
R2_ACCESS_KEY_ID=<acceso R2>
R2_SECRET_ACCESS_KEY=<secreto R2>
R2_BUCKET_NAME=survey-images
R2_PUBLIC_URL=https://pub-HASH.r2.dev
ADMIN_EMAIL=admin@voxchiapas.mx
ADMIN_PASSWORD=<contraseña segura>
PDF_WORKER_URL=https://pdf-generator.TU-USUARIO.workers.dev
NEXT_PUBLIC_BASE_URL=https://vox-chiapas.onrender.com
```

Generar valores aleatorios con:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Sembrar datos iniciales (seed)

```bash
# Local, con .env.local completo
npm run seed
```

Esto crea el usuario administrador con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 7. Despliegue en Render

### 7a. Subir código a GitHub
```bash
git init
git add .
git commit -m "Initial commit — Vox Chiapas"
git remote add origin https://github.com/TU-USUARIO/vox-chiapas.git
git push -u origin main
```

### 7b. Crear Web Service en Render
1. [render.com](https://render.com) → **New → Web Service** → conectar el repositorio.
2. Configuración:
   | Campo | Valor |
   |---|---|
   | **Environment** | Node |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | Free |
   | **Node Version** | 20 |

3. En **Environment → Add Environment Variables** agregar todas las variables del paso 5.
4. Hacer clic en **Create Web Service**.

> **Nota Free tier:** el servicio duerme tras 15 min de inactividad; la primera solicitud puede tardar ~30 segundos en despertar.

---

## 8. Verificación post-despliegue

- `GET https://vox-chiapas.onrender.com/` → página pública con encuestas
- `GET https://vox-chiapas.onrender.com/admin` → login del administrador
- `POST /api/admin/login` con credenciales del seed
- Crear una encuesta desde el panel
- Votar desde la URL pública
- Ver resultados en tiempo real en el panel

---

## Arquitectura final

```
Usuarios  →  Render (Next.js 14, Node.js 20)
                ├── Supabase PostgreSQL (Transaction Pooler :6543)
                ├── Upstash Redis (HTTP client)
                └── Cloudflare R2 (imágenes via aws4fetch)

Cloudflare Workers (independientes):
  vote-processor  →  cron 1 min → lee Redis → escribe Supabase
  pdf-generator   →  llamado vía HTTP desde la app → genera PDF
```
