/**
 * components/Toast.tsx — Notificación tipo toast animada
 */
'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number   // ms, default 3000
  onDone?: () => void
}

export default function Toast({ message, type = 'success', duration = 3000, onDone }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), duration - 400)
    const done = setTimeout(() => onDone?.(), duration)
    return () => { clearTimeout(hide); clearTimeout(done) }
  }, [duration, onDone])

  const colors = {
    success: 'bg-green-600',
    error:   'bg-red-600',
    info:    'bg-brand-600',
  }

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  }

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium
        transition-all duration-400 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        ${colors[type]}`}
      role="alert"
    >
      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">
        {icons[type]}
      </span>
      {message}
    </div>
  )
}
