/**
 * app/survey/[id]/VoteForm.tsx — Formulario de votación anónima
 * Muestra resultado "¡Gracias!" o "Ya votaste" — nunca gráficas.
 */
'use client'

import { useState } from 'react'
import type { Option } from '@/lib/types'

interface VoteFormProps {
  surveyId: string
  question: string
  options: Option[]
}

type State = 'idle' | 'submitting' | 'voted' | 'already_voted' | 'error'

export default function VoteForm({ surveyId, question, options }: VoteFormProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return

    setState('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyId, optionId: selected }),
      })

      if (res.status === 409) {
        setState('already_voted')
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Ocurrió un error. Intenta de nuevo.')
        setState('error')
        return
      }

      setState('voted')
    } catch {
      setErrorMsg('Error de red. Por favor, intenta de nuevo.')
      setState('error')
    }
  }

  if (state === 'voted') {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-semibold text-green-700">¡Gracias por tu voto!</h2>
        <p className="text-gray-500 mt-2">Tu respuesta ha sido registrada de forma anónima.</p>
      </div>
    )
  }

  if (state === 'already_voted') {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-semibold text-brand-700">Ya registraste tu voto</h2>
        <p className="text-gray-500 mt-2">Ya participaste en esta encuesta anteriormente.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-lg font-medium text-gray-800 mb-4">{question}</p>

      <fieldset className="space-y-2">
        <legend className="sr-only">Selecciona una opción</legend>
        {options.map(opt => (
          <label
            key={opt.id}
            className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
              selected === opt.id
                ? 'border-brand-500 bg-brand-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="option"
              value={opt.id}
              checked={selected === opt.id}
              onChange={() => setSelected(opt.id)}
              className="accent-brand-600 w-4 h-4"
            />
            <span className="text-gray-800">{opt.text}</span>
          </label>
        ))}
      </fieldset>

      {state === 'error' && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={!selected || state === 'submitting'}
        className="w-full py-3 px-6 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'submitting' ? 'Enviando...' : 'Votar'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Tu voto es completamente anónimo. No se recopilan datos personales.
      </p>
    </form>
  )
}
