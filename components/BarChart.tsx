/**
 * components/BarChart.tsx — Gráfica de barras horizontales SVG (UI)
 * Reutilizable en el panel de admin y como base para el PDF.
 */
'use client'

interface BarChartOption {
  id: string
  text: string
  count: number
  percentage: number
}

interface BarChartProps {
  options: BarChartOption[]
  total: number
}

const BAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#6366f1',
]

export default function BarChart({ options, total }: BarChartProps) {
  if (!options || options.length === 0) {
    return <p className="text-gray-400 text-sm">Sin datos aún.</p>
  }

  const sorted = [...options].sort((a, b) => b.count - a.count)
  const maxCount = sorted[0]?.count ?? 1

  return (
    <div className="space-y-3">
      {sorted.map((opt, i) => {
        const pct = total > 0 ? (opt.count / total) * 100 : 0
        const color = BAR_COLORS[i % BAR_COLORS.length]

        return (
          <div key={opt.id} className="flex items-center gap-3">
            {/* Etiqueta */}
            <span
              className="text-sm text-gray-700 text-right shrink-0"
              style={{ width: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={opt.text}
            >
              {opt.text}
            </span>

            {/* Barra */}
            <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
              <div
                className="h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{
                  width: maxCount > 0 ? `${(opt.count / maxCount) * 100}%` : '0%',
                  backgroundColor: color,
                  minWidth: opt.count > 0 ? '20px' : '0',
                }}
              />
            </div>

            {/* Estadísticas */}
            <span className="text-sm font-medium text-gray-900 shrink-0 w-24 text-right">
              {opt.count.toLocaleString()} ({pct.toFixed(1)}%)
            </span>
          </div>
        )
      })}

      <p className="text-xs text-gray-500 mt-2">
        Total: <strong>{total.toLocaleString()}</strong> votos
      </p>
    </div>
  )
}
