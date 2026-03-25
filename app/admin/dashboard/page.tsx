/**
 * app/admin/dashboard/page.tsx — Dashboard con métricas en tiempo real
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { DashboardMetrics } from '@/lib/types'

function MetricCard({ label, value, icon, color }: {
  label: string; value: number | string; icon: string; color: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-start gap-4`}>
      <div className={`text-3xl`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${color}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  async function fetchMetrics() {
    try {
      const res = await fetch('/api/admin/dashboard')
      if (!res.ok) throw new Error('Error al cargar métricas')
      setMetrics(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    // Actualizar cada 30 segundos
    const id = setInterval(fetchMetrics, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Métricas en tiempo real · actualizado cada 30s</p>
        </div>
        <Link
          href="/admin/surveys/new"
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Nueva encuesta
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-28 animate-pulse" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total de votos"       value={metrics.total_votes}    icon="🗳️"  color="text-brand-700" />
          <MetricCard label="Votos hoy"            value={metrics.votes_today}    icon="📅"  color="text-green-600" />
          <MetricCard label="Encuestas activas"    value={metrics.active_surveys} icon="✅"  color="text-emerald-600" />
          <MetricCard label="Encuestas cerradas"   value={metrics.closed_surveys} icon="🔒" color="text-gray-500" />
        </div>
      ) : null}

      <div className="mt-8">
        <Link
          href="/admin/surveys"
          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          Ver todas las encuestas →
        </Link>
      </div>
    </div>
  )
}
