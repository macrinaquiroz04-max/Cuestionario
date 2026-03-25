/**
 * components/AdminSidebar.tsx — Navegación lateral + drawer móvil
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/surveys',   label: 'Encuestas',  icon: '📋' },
]

export default function AdminSidebar() {
  const pathname   = usePathname()
  const [loggingOut,  setLoggingOut]  = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // No mostrar el sidebar en la página de login
  if (pathname === '/admin/login') return null

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch { /* noop */ }
    // Flag para mostrar toast en login
    sessionStorage.setItem('vox_toast', 'logout')
    // Forzar recarga completa para que el middleware limpie la sesión
    window.location.replace('/admin/login')
  }

  const NavLinks = () => (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-700 text-white'
                  : 'text-brand-100 hover:bg-brand-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-brand-800">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-brand-100 hover:bg-brand-800 hover:text-white transition-colors disabled:opacity-50"
        >
          <span>🚪</span>
          {loggingOut ? 'Cerrando...' : 'Cerrar sesión'}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-60 min-h-screen bg-brand-900 text-white flex-col shrink-0">
        <div className="px-6 py-5 border-b border-brand-800">
          <h1 className="text-lg font-bold tracking-tight">Vox Chiapas</h1>
          <p className="text-xs text-brand-100 mt-0.5 opacity-70">Panel de administración</p>
        </div>
        <NavLinks />
      </aside>

      {/* ── Barra superior móvil (fija) ──────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-brand-900 text-white flex items-center justify-between px-4 py-3 shadow-md">
        <h1 className="text-base font-bold tracking-tight">Vox Chiapas</h1>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="p-1.5 rounded hover:bg-brand-800 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Drawer móvil ─────────────────────────────────────────────── */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-brand-900 text-white flex flex-col z-50 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-brand-800 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Vox Chiapas</h1>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
            className="p-1 rounded hover:bg-brand-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <NavLinks />
      </aside>
    </>
  )
}
