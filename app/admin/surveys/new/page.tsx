/**
 * app/admin/surveys/new/page.tsx — Crear nueva encuesta
 */
import SurveyForm from '@/components/SurveyForm'

export default function NewSurveyPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nueva encuesta</h1>
        <p className="text-gray-500 text-sm mt-0.5">Completa los campos para crear una nueva encuesta.</p>
      </div>
      <SurveyForm mode="create" />
    </div>
  )
}
