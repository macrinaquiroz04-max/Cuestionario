/**
 * app/admin/surveys/page.tsx — Lista y gestión de encuestas
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DeleteModal from '@/components/DeleteModal'
import type { Survey } from '@/lib/types'

interface SurveysResponse {
  surveys: Survey[]
  total: number
}

export default function SurveysPage() {
  const [data, setData]           = useState<SurveysResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [toDelete, setToDelete]   = useState<Survey | null>(null)
  const [deleting, setDeleting]   = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function fetchSurveys() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/surveys?limit=50')
      if (!res.ok) throw new Error('Error al cargar encuestas')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSurveys() }, [])

  async function handleToggle(survey: Survey) {
    await fetch(`/api/admin/surveys/${survey.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !survey.is_active }),
    })
    fetchSurveys()
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/surveys/${toDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      setToDelete(null)
      fetchSurveys()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Encuestas</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data ? `${data.total} encuestas en total` : ''}
          </p>
        </div>
        <Link
          href="/admin/surveys/new"
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Nueva encuesta
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {data?.surveys.map(survey => (
            <div
              key={survey.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 flex flex-wrap sm:flex-nowrap items-center gap-3"
            >
              {survey.image_url && (
                <img
                  src={survey.image_url}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{survey.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {survey.is_active ? (
                    <span className="text-green-600 font-medium">● Activa</span>
                  ) : (
                    <span className="text-gray-400 font-medium">● Cerrada</span>
                  )}
                  {survey.close_at && (
                    <span className="ml-2">
                      · Cierra: {new Date(survey.close_at).toLocaleDateString('es-MX')}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                <Link
                  href={`/admin/surveys/${survey.id}/results`}
                  className="px-3 py-1.5 text-xs font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg transition-colors"
                >
                  Resultados
                </Link>
                <Link
                  href={`/admin/surveys/${survey.id}/edit`}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Editar
                </Link>
                <button
                  onClick={() => handleToggle(survey)}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {survey.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => setToDelete(survey)}
                  className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}

          {data?.surveys.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-5xl mb-4">📋</p>
              <p>No hay encuestas creadas aún.</p>
            </div>
          )}
        </div>
      )}

      {toDelete && (
        <DeleteModal
          title={toDelete.title}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}
