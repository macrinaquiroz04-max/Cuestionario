/**
 * components/AdminToastHandler.tsx — Detecta flags de sessionStorage y muestra toasts
 */
'use client'

import { useEffect, useState } from 'react'
import Toast from './Toast'

export default function AdminToastHandler() {
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const flag = sessionStorage.getItem('vox_toast')
    if (flag === 'login') {
      sessionStorage.removeItem('vox_toast')
      setToast('login')
    }
  }, [])

  if (!toast) return null

  return (
    <Toast
      message="¡Bienvenido al panel!"
      type="success"
      onDone={() => setToast(null)}
    />
  )
}
