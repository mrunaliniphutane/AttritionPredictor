import React from 'react'

export default function Footer() {
  return (
    <footer className="bg-card-dark border-t border-border py-4 mt-auto">
      <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between text-xs text-muted">
        <span>© 2025 KALA Group — HR Analytics Platform</span>
        <span className="gradient-text font-semibold">Powered by AI | KALA Group</span>
        <span className="hidden md:block">🔒 Data never stored on server</span>
      </div>
    </footer>
  )
}
