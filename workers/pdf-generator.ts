/**
 * workers/pdf-generator.ts — Cloudflare Worker: Generador de PDF
 *
 * Requiere Node.js compat flag para @react-pdf/renderer.
 * Recibe los datos de la encuesta por POST y retorna el PDF como binario.
 *
 * Seguridad: verifica X-Internal-Secret antes de generar el PDF.
 *
 * Deploy:
 *   cd workers
 *   npx wrangler deploy pdf-generator.ts --name pdf-generator \
 *     --compatibility-flags nodejs_compat \
 *     --compatibility-date 2024-09-23
 */

import { generateSurveyPDF } from '../lib/pdf'
import type { SurveyResults } from '../lib/types'

export interface Env {
  JWT_SECRET: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname !== '/generate-pdf' || request.method !== 'POST') {
      return new Response('Not Found', { status: 404 })
    }

    // ── Verificar secreto interno ────────────────────────────────────────────
    const secret = request.headers.get('X-Internal-Secret')
    if (!secret || secret !== env.JWT_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    // ── Parsear datos ─────────────────────────────────────────────────────────
    let data: SurveyResults
    try {
      data = await request.json() as SurveyResults
    } catch {
      return new Response('JSON inválido', { status: 400 })
    }

    if (!data?.survey || !data?.options) {
      return new Response('Datos incompletos', { status: 400 })
    }

    // ── Generar PDF ───────────────────────────────────────────────────────────
    try {
      const pdfBuffer = await generateSurveyPDF(data)

      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="reporte-${data.survey.id}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
      console.error('[pdf-generator] Error:', err)
      return new Response('Error al generar PDF', { status: 500 })
    }
  },
}
