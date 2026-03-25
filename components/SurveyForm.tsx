/**
 * components/SurveyForm.tsx — Formulario reutilizable para crear/editar encuesta
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUpload from './ImageUpload'
import type { Survey, Option } from '@/lib/types'

interface SurveyFormProps {
  initialSurvey?: Survey
  initialOptions?: Option[]
  mode: 'create' | 'edit'
}

interface OptionField {
  id?: string
  text: string
  order: number
}

export default function SurveyForm({ initialSurvey, initialOptions, mode }: SurveyFormProps) {
  const router = useRouter()

  const [title, setTitle]           = useState(initialSurvey?.title ?? '')
  const [description, setDesc]      = useState(initialSurvey?.description ?? '')
  const [imageUrl, setImageUrl]     = useState<string | null>(initialSurvey?.image_url ?? null)
  const [question, setQuestion]     = useState(initialSurvey?.question ?? '')
  const [isActive, setIsActive]     = useState(initialSurvey?.is_active ?? true)
  const [closeAt, setCloseAt]       = useState(
    initialSurvey?.close_at
      ? new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Mexico_City',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        }).format(new Date(initialSurvey.close_at)).replace(' ', 'T')
      : ''
  )
  const [options, setOptions] = useState<OptionField[]>(
    initialOptions?.map(o => ({ id: o.id, text: o.text, order: o.order })) ??
    [{ text: '', order: 0 }, { text: '', order: 1 }]
  )

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)

  function addOption() {
    if (options.length >= 10) return
    setOptions([...options, { text: '', order: options.length }])
  }

  function removeOption(i: number) {
    if (options.length <= 2) return
    setOptions(options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, order: idx })))
  }

  function updateOption(i: number, text: string) {
    setOptions(options.map((o, idx) => idx === i ? { ...o, text } : o))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const body = {
      title,
      description: description || null,
      image_url: imageUrl,
      question,
      is_active: isActive,
      close_at: closeAt ? new Date(closeAt + '-06:00').toISOString() : null,
      options: options.map((o, i) => ({ ...o, text: o.text.trim(), order: i })).filter(o => o.text),
    }

    if (body.options.length < 2) {
      setError('Debes ingresar al menos 2 opciones.')
      setLoading(false)
      return
    }

    try {
      const url = mode === 'create'
        ? '/api/admin/surveys'
        : `/api/admin/surveys/${initialSurvey!.id}`

      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar')
        return
      }

      if (mode === 'create') {
        setCreatedId(data.survey.id)
      } else {
        router.push('/admin/surveys')
        router.refresh()
      }
    } catch {
      setError('Error de red al guardar')
    } finally {
      setLoading(false)
    }
  }

  if (createdId) {
    const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/survey/${createdId}`

    async function copyLink() {
      try {
        await navigator.clipboard.writeText(publicUrl)
      } catch {
        // Fallback para móvil / Safari sin permisos de clipboard
        const el = document.createElement('textarea')
        el.value = publicUrl
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        el.style.top = '-9999px'
        document.body.appendChild(el)
        el.focus()
        el.select()
        el.setSelectionRange(0, 99999)
        try { document.execCommand('copy') } catch { /* noop */ }
        document.body.removeChild(el)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }

    return (
      <div className="max-w-2xl space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-3">
          <p className="text-green-700 font-semibold text-lg">¡Encuesta creada exitosamente!</p>
          <p className="text-sm text-gray-600">Comparte este enlace con los participantes:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={publicUrl}
              onFocus={e => e.target.select()}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-mono"
            />
            <button
              type="button"
              onClick={copyLink}
              className={`flex-shrink-0 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                copied ? 'bg-green-600' : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/surveys')}
            className="px-5 py-2.5 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors"
          >
            Ir a la lista
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Ver encuesta
          </a>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Título */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          maxLength={255}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Ej: ¿Cuál es tu lenguaje favorito?"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          value={description}
          onChange={e => setDesc(e.target.value)}
          rows={2}
          maxLength={1000}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="Descripción opcional..."
        />
      </div>

      {/* Imagen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Imagen de portada</label>
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
      </div>

      {/* Pregunta */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pregunta *</label>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          required
          maxLength={500}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="La pregunta que verán los participantes"
        />
      </div>

      {/* Opciones */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Opciones ({options.length}/10) *
        </label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-gray-400 w-5">{i + 1}.</span>
              <input
                type="text"
                value={opt.text}
                onChange={e => updateOption(i, e.target.value)}
                maxLength={500}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder={`Opción ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                disabled={options.length <= 2}
                className="text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                title="Eliminar opción"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {options.length < 10 && (
          <button
            type="button"
            onClick={addOption}
            className="mt-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            + Agregar opción
          </button>
        )}
      </div>

      {/* Estado y fecha */}
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <input
            id="is_active"
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 accent-brand-600"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Activa (visible para el público)
          </label>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de cierre</label>
          <input
            type="datetime-local"
            value={closeAt}
            onChange={e => setCloseAt(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : mode === 'create' ? 'Crear encuesta' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
