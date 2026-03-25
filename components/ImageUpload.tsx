/**
 * components/ImageUpload.tsx — Upload de imagen a R2 desde el admin
 */
'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

interface ImageUploadProps {
  value: string | null
  onChange: (url: string | null) => void
}

export default function ImageUpload({ value, onChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al subir imagen')
      } else {
        onChange(data.url)
      }
    } catch {
      setError('Error de red al subir imagen')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {value && (
        <div className="relative flex justify-center w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Portada" className="max-w-full h-auto" style={{ maxHeight: '240px', imageOrientation: 'from-image' }} />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 bg-white/80 hover:bg-white text-gray-700 rounded-full w-7 h-7 flex items-center justify-center text-sm shadow"
          >
            ✕
          </button>
        </div>
      )}

      {!value && (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-colors"
        >
          {uploading ? (
            <p className="text-sm text-gray-500">Subiendo...</p>
          ) : (
            <>
              <span className="text-2xl mb-1">🖼️</span>
              <p className="text-sm text-gray-500">Haz clic para subir imagen</p>
              <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG, WebP · Máx 5 MB</p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
        disabled={uploading}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
