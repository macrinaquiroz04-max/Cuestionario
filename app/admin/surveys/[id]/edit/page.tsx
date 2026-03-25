/**
 * app/admin/surveys/[id]/edit/page.tsx — Editar encuesta existente
 */

import { notFound } from 'next/navigation'
import SurveyForm from '@/components/SurveyForm'
import type { Survey, Option } from '@/lib/types'

interface PageProps { params: { id: string } }

async function getSurveyData(id: string): Promise<{ survey: Survey; options: Option[] } | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    // Para rutas admin del servidor usamos las cookies — pero en SSR debemos pasar el header.
    // Aquí hacemos la llamada a la API con cache: no-store.
    const res = await fetch(`${baseUrl}/api/admin/surveys/${id}`, {
      cache: 'no-store',
      // NOTA: En producción, el middleware ya verifica el JWT.
      // Aquí necesitamos las cookies del request — se pasan automáticamente en SSR.
    })
    if (!res.ok) return null
    return res.json()
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
