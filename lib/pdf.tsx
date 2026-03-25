/**
 * lib/pdf.ts — Generador de PDF con @react-pdf/renderer
 * Incluye gráfica SVG de barras horizontales renderizada dentro del PDF.
 *
 * NOTA: @react-pdf/renderer requiere entorno Node.js.
 * Este helper es llamado desde el PDF Worker (workers/pdf-generator.ts)
 * o desde una API route con nodejs runtime — NO desde Edge Runtime.
 */
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Svg,
  Rect,
  G,
  Line,
  renderToBuffer,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { SurveyResults } from './types'

// ─── Paleta de colores para barras ──────────────────────────────────────────
const BAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#6366f1',
]

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingBottom: 16,
  },
  headerImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 16,
    objectFit: 'cover',
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1e3a8a', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#6b7280' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryGrid: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryLabel: { fontSize: 8, color: '#6b7280', marginBottom: 2 },
  summaryValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1e3a8a' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  colOption: { flex: 3, fontSize: 9, color: '#374151' },
  colVotes:  { flex: 1, fontSize: 9, color: '#374151', textAlign: 'right' },
  colPct:    { flex: 1, fontSize: 9, color: '#374151', textAlign: 'right' },
  colOptionH: { flex: 3, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  colVotesH:  { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff', textAlign: 'right' },
  colPctH:    { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff', textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: '#9ca3af' },
})

// ─── Componente: Gráfica SVG de barras horizontales ──────────────────────────
function BarChart({ options, total }: {
  options: { text: string; count: number; percentage: number }[]
  total: number
}) {
  const BAR_HEIGHT = 20
  const GAP = 8
  const LABEL_WIDTH = 130
  const BAR_MAX_WIDTH = 260
  const STATS_WIDTH = 70
  const SVG_WIDTH = LABEL_WIDTH + BAR_MAX_WIDTH + STATS_WIDTH + 16
  const SVG_HEIGHT = options.length * (BAR_HEIGHT + GAP) + GAP

  return (
    <Svg width={SVG_WIDTH} height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
      {options.map((opt, i) => {
        const y = GAP + i * (BAR_HEIGHT + GAP)
        const barWidth = total > 0 ? (opt.count / total) * BAR_MAX_WIDTH : 0
        const color = BAR_COLORS[i % BAR_COLORS.length]

        return (
          <G key={opt.text}>
            {/* Etiqueta de la opción */}
            <Text
              style={{ fontSize: 8, fill: '#374151' }}
              x={LABEL_WIDTH - 6}
              y={y + BAR_HEIGHT / 2 + 3}
              textAnchor="end"
            >
              {opt.text.length > 22 ? opt.text.slice(0, 20) + '…' : opt.text}
            </Text>
            {/* Fondo de barra */}
            <Rect
              x={LABEL_WIDTH}
              y={y}
              width={BAR_MAX_WIDTH}
              height={BAR_HEIGHT}
              rx={3}
              fill="#f1f5f9"
            />
            {/* Barra de valor */}
            {barWidth > 0 && (
              <Rect
                x={LABEL_WIDTH}
                y={y}
                width={barWidth}
                height={BAR_HEIGHT}
                rx={3}
                fill={color}
              />
            )}
            {/* Estadísticas */}
            <Text
              style={{ fontSize: 8, fill: '#374151' }}
              x={LABEL_WIDTH + BAR_MAX_WIDTH + 8}
              y={y + BAR_HEIGHT / 2 + 3}
            >
              {`${opt.count} (${opt.percentage.toFixed(1)}%)`}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}

// ─── Documento PDF principal ──────────────────────────────────────────────────
function SurveyReport({ data, generatedAt }: { data: SurveyResults; generatedAt: string }) {
  const { survey, options, total_votes, last_vote_at } = data

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

  return (
    <Document author="Vox Chiapas" title={`Reporte: ${survey.title}`}>
      <Page size="A4" style={styles.page}>
        {/* ENCABEZADO */}
        <View style={styles.header}>
          {survey.image_url && (
            <Image src={survey.image_url} style={styles.headerImage} />
          )}
          <View style={styles.headerText}>
            <Text style={styles.title}>{survey.title}</Text>
            <Text style={styles.subtitle}>
              Reporte generado el {generatedAt}
            </Text>
            {survey.description && (
              <Text style={{ fontSize: 9, color: '#4b5563', marginTop: 4 }}>
                {survey.description}
              </Text>
            )}
          </View>
        </View>

        {/* RESUMEN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total de votos</Text>
              <Text style={styles.summaryValue}>{total_votes.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Estado</Text>
              <Text style={[styles.summaryValue, { fontSize: 12 }]}>
                {survey.is_active ? 'Activa' : 'Cerrada'}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Fecha de inicio</Text>
              <Text style={[styles.summaryValue, { fontSize: 10 }]}>
                {formatDate(survey.created_at)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Último voto</Text>
              <Text style={[styles.summaryValue, { fontSize: 10 }]}>
                {formatDate(last_vote_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* GRÁFICA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resultados — {survey.question}</Text>
          <BarChart options={options} total={total_votes} />
        </View>

        {/* TABLA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tabla de resultados</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colOptionH}>Opción</Text>
            <Text style={styles.colVotesH}>Votos</Text>
            <Text style={styles.colPctH}>Porcentaje</Text>
          </View>
          {options.map((opt, i) => (
            <View
              key={opt.id}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={styles.colOption}>{opt.text}</Text>
              <Text style={styles.colVotes}>{opt.count.toLocaleString()}</Text>
              <Text style={styles.colPct}>{opt.percentage.toFixed(1)}%</Text>
            </View>
          ))}
          <View style={[styles.tableRow, { borderTopWidth: 2, borderTopColor: '#e5e7eb' }]}>
            <Text style={[styles.colOption, { fontFamily: 'Helvetica-Bold' }]}>Total</Text>
            <Text style={[styles.colVotes, { fontFamily: 'Helvetica-Bold' }]}>
              {total_votes.toLocaleString()}
            </Text>
            <Text style={[styles.colPct, { fontFamily: 'Helvetica-Bold' }]}>100%</Text>
          </View>
        </View>

        {/* PIE DE PÁGINA */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Vox Chiapas</Text>
          <Text style={styles.footerText}>Generado el {generatedAt}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

// ─── Función pública para generar el buffer del PDF ──────────────────────────
export async function generateSurveyPDF(data: SurveyResults): Promise<Buffer> {
  const generatedAt = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const element = React.createElement(SurveyReport, { data, generatedAt })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any)
}
