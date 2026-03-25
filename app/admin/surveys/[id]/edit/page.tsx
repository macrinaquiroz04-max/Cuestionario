/**
 * app/admin/surveys/[id]/edit/page.tsx — Editar encuesta existente
 */

import { notFound } from 'next/navigation'
import SurveyForm from '@/components/SurveyForm'
import sql from '@/lib/db'
import type { Survey, Option } from '@/lib/types'

interface PageProps { params: { id: string } }

async function getSurveyData(id: string): Promise<{ survey: Survey; options: Option[] } | null> {
  try {
    const [survey] = await sql<Survey[]>`SELECT * FROM surveys WHERE id = ${id}`
    if (!survey) return null
    const options = await sql<Option[]>`
      SELECT * FROM options WHERE survey_id = ${id} ORDER BY "order" ASC
    `
    return { survey, options }
  } catch {
    return null
  }
}

export default async function EditSurveyPage({ params }: PageProps) {
  const data = await getSurveyData(params.id)
  if (!data) notFound()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Editar encuesta</h1>
        <p className="text-gray-500 text-sm mt-0.5 truncate max-w-lg">{data.survey.title}</p>
      </div>
      <SurveyForm
        mode="edit"
        initialSurvey={data.survey}
        initialOptions={data.options}
      />
    </div>
  )
}
