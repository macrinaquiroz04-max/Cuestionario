/**
 * app/admin/surveys/[id]/results/page.tsx
 * Resultados de encuesta con gráfica interactiva + exportación PDF y CSV
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import BarChart from '@/components/BarChart'
import type { SurveyResults } from '@/lib/types'

export default function ResultsPage() {
  const params = useParams()
  const id = params.id as string

  const [data, setData]         = useState<SurveyResults | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null)

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/surveys/${id}/results`)
      if (!res.ok) throw new Error('Error al cargar resultados')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchResults()
    const interval = setInterval(fetchResults, 30_000)
    return () => clearInterval(interval)
  }, [fetchResults])

  async function handleExport(type: 'pdf' | 'csv') {
    setExporting(type)
    try {
      const res = await fetch(`/api/admin/surveys/${id}/export-${type}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Error al exportar' }))
        alert(data.error ?? 'Error al exportar')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-${id}.${type}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error al exportar. Intenta de nuevo.')
    } finally {
      setExporting(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-64" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          {error ?? 'No se encontraron resultados'}
        </div>
      </div>
    )
  }

  const { survey, options, total_votes, last_vote_at } = data

  return (
    <div className="p-8 max-w-4xl">
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/surveys"
            className="text-sm text-gray-500 hover:text-brand-600 transition-colors mb-2 block"
          >
            ← Volver a encuestas
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
          <p className="text-gray-500 mt-1 text-sm">{survey.question}</p>
        </div>

        {/* Botones de exportación */}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            className="px-4 py-2 text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {exporting === 'csv' ? '⏳ Exportando…' : '📥 Exportar CSV'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="px-4 py-2 text-sm font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {exporting === 'pdf' ? '⏳ Generando PDF…' : '📄 Exportar PDF'}
          </button>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total de votos', value: total_votes.toLocaleString(), icon: '🗳️' },
          { label: 'Estado', value: survey.is_active ? 'Activa' : 'Cerrada', icon: survey.is_active ? '✅' : '🔒' },
          {
            label: 'Creada',
            value: new Date(survey.created_at).toLocaleDateString('es-MX'),
            icon: '📅',
          },
          {
            label: 'Último voto',
            value: last_vote_at ? new Date(last_vote_at).toLocaleDateString('es-MX') : '—',
            icon: '🕐',
          },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">{m.label}</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">
              {m.icon} {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Gráfica */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Resultados por opción</h2>
        <BarChart options={options} total={total_votes} />
      </div>

      {/* Tabla detallada */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Tabla de resultados</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Opción</th>
              <th className="text-right px-6 py-3 font-medium">Votos</th>
              <th className="text-right px-6 py-3 font-medium">Porcentaje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {options.map(opt => (
              <tr key={opt.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 text-gray-800">{opt.text}</td>
                <td className="px-6 py-3 text-right font-medium text-gray-900">
                  {opt.count.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-right text-gray-500">
                  {opt.percentage.toFixed(1)}%
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-6 py-3 text-gray-900">Total</td>
              <td className="px-6 py-3 text-right text-gray-900">{total_votes.toLocaleString()}</td>
              <td className="px-6 py-3 text-right text-gray-900">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4 text-right">
        Actualizado automáticamente cada 30 segundos · fuente: Redis + PostgreSQL
      </p>
    </div>
  )
}
