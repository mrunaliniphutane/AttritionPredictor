import React from 'react'

export default function TabNav({ tabs, active, onChange }) {
  return (
    <div className="bg-card-dark border-b border-border sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6">
        <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`tab-btn ${active === tab.id ? 'tab-active' : 'tab-inactive'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
