/**
 * app/survey/[id]/page.tsx — Página pública de votación (sin resultados)
 */

import { notFound } from 'next/navigation'
import sql from '@/lib/db'
import type { Survey, Option } from '@/lib/types'
import VoteForm from './VoteForm'

interface PageProps {
  params: { id: string }
}

async function getSurveyData(id: string): Promise<{ survey: Survey; options: Option[] } | null> {
  try {
    const [survey] = await sql<Survey[]>`
      SELECT id, title, description, image_url, question, is_active, close_at, created_at
      FROM surveys
      WHERE id = ${id}
        AND is_active = true
        AND (close_at IS NULL OR close_at > now())
    `
    if (!survey) return null

    const options = await sql<Option[]>`
      SELECT id, survey_id, text, "order"
      FROM options
      WHERE survey_id = ${id}
      ORDER BY "order" ASC
    `
    return { survey, options }
  } catch {
    return null
  }
}

export default async function SurveyPage({ params }: PageProps) {
  const data = await getSurveyData(params.id)
  if (!data) notFound()

  const { survey, options } = data

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <a href="/" className="text-sm text-gray-500 hover:text-brand-600 transition-colors">
            ← Volver a encuestas
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Imagen de portada */}
        {survey.image_url && (
          <div className="flex justify-center mb-6">
            <img
              src={survey.image_url}
              alt={survey.title}
              className="rounded-xl shadow max-w-full h-auto"
              style={{ maxHeight: '280px', maxWidth: '280px', imageOrientation: 'from-image' }}
            />
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{survey.title}</h1>
          {survey.description && (
            <p className="text-gray-600 mb-6">{survey.description}</p>
          )}

          <VoteForm surveyId={survey.id} question={survey.question} options={options} />
        </div>
      </div>
    </main>
  )
}
