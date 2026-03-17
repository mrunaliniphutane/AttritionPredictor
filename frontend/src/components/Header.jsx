import React from 'react'

export default function Header() {
  return (
    <header className="bg-card-dark border-b border-border shadow-2xl">
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center text-bg font-black text-lg shadow-lg">
            K
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text leading-tight">
              KALA Group
            </h1>
            <p className="text-xs text-muted font-medium tracking-wide">
              Employee Attrition Intelligence System
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-success/10 border border-success/20 rounded-lg px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-success font-medium">AI Engine Active</span>
          </div>
          <div className="text-xs text-muted border border-border rounded-lg px-3 py-1.5">
            Powered by XGBoost + SHAP
          </div>
        </div>
      </div>
    </header>
  )
}
