/**
 * app/page.tsx — Home público: lista de encuestas activas
 */
import Link from 'next/link'
import sql from '@/lib/db'
import type { Survey } from '@/lib/types'

export const revalidate = 0 // nunca cachear — siempre leer fresco

async function getSurveys(): Promise<Survey[]> {
  try {
    return await sql<Survey[]>`
      SELECT id, title, description, image_url, question, is_active, close_at, created_at
      FROM surveys
      WHERE is_active = true
        AND (close_at IS NULL OR close_at > now())
      ORDER BY created_at DESC
    `
  } catch {
    return []
  }
}

export default async function HomePage() {
  const surveys = await getSurveys()

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-brand-800">Vox Chiapas</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Encuestas activas</h2>
        <p className="text-gray-500 mb-8">Selecciona una encuesta para participar de forma anónima.</p>

        {surveys.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-lg">No hay encuestas activas en este momento.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {surveys.map(survey => (
              <Link
                key={survey.id}
                href={`/survey/${survey.id}`}
                className="group block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all overflow-hidden"
              >
                {survey.image_url && (
                  <div className="h-36 overflow-hidden">
                    <img
                      src={survey.image_url}
                      alt={survey.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
                    {survey.title}
                  </h3>
                  {survey.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{survey.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-3">
                    {survey.close_at
                      ? `Cierra el ${new Date(survey.close_at).toLocaleDateString('es-MX')}`
                      : 'Sin fecha de cierre'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
