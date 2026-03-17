import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, Cell
} from 'recharts'
import { fetchEDA } from '../utils/api'
import toast from 'react-hot-toast'
import { formatINR, formatPct } from '../utils/api'

export default function OverviewTab({ dataId, uploadData }) {
  const [eda, setEda] = useState(null)

  useEffect(() => {
    fetchEDA(dataId)
      .then(setEda)
      .catch(e => toast.error('Overview load failed: ' + (e.response?.data?.error || e.message)))
  }, [dataId])

  const { attrition_split, rows, cols, columns } = uploadData
  const total = rows
  const yesKey = Object.keys(attrition_split || {}).find(k => k === 'Yes' || k === '1') || 'Yes'
  const noKey = Object.keys(attrition_split || {}).find(k => k === 'No' || k === '0') || 'No'
  const attrited = attrition_split?.[yesKey] || 0
  const retained = attrition_split?.[noKey] || 0
  const attritionPct = total ? ((attrited / total) * 100).toFixed(1) : 0

  // Donut SVG
  const DonutChart = () => {
    const r = 60, cx = 80, cy = 80
    const circ = 2 * Math.PI * r
    const pct = attrited / (attrited + retained)
    const dash = pct * circ
    return (
      <svg viewBox="0 0 160 160" className="w-40 h-40">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2A3F6A" strokeWidth="18" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#FB7185" strokeWidth="18"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#34D399" strokeWidth="18"
          strokeDasharray={`${circ - dash} ${circ}`}
          strokeDashoffset={-(dash)}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'all 1s ease' }}
        />
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#E2E8F0" fontSize="18" fontWeight="700">{attritionPct}%</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#8899BB" fontSize="10">Attrition</text>
      </svg>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="metric-label">Total Employees</div>
          <div className="metric-value gradient-text">{total}</div>
          <div className="text-xs text-muted">{cols} features</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Attrition Rate</div>
          <div className="metric-value text-danger">{attritionPct}%</div>
          <div className="text-xs text-muted">{attrited} left</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Retained</div>
          <div className="metric-value text-success">{retained}</div>
          <div className="text-xs text-muted">{((retained / total) * 100).toFixed(1)}% retention</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Features</div>
          <div className="metric-value text-gold">{cols}</div>
          <div className="text-xs text-muted">columns in dataset</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Donut */}
        <div className="card flex flex-col items-center justify-center gap-4">
          <div className="section-title">Attrition Split</div>
          <DonutChart />
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-danger inline-block" /> Attrited ({attrited})</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-success inline-block" /> Retained ({retained})</span>
          </div>
        </div>

        {/* Dept bar */}
        <div className="card md:col-span-2">
          <div className="section-title">Department Attrition Rate</div>
          {eda ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(eda.attrition_by_dept?.labels || []).map((l, i) => ({ name: l, rate: eda.attrition_by_dept.values[i] }))} margin={{ bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8899BB' }} angle={-10} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#8899BB' }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, 'Attrition']} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                <Bar dataKey="rate" fill="#D4A843" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="skeleton h-48" />}
        </div>
      </div>

      {/* Data preview */}
      <div className="card overflow-x-auto">
        <div className="section-title">📋 Dataset Columns ({cols})</div>
        <div className="flex flex-wrap gap-2">
          {columns.map((col) => (
            <span key={col} className="bg-card-dark border border-border rounded-lg px-3 py-1 text-xs text-muted font-mono hover:border-gold hover:text-gold transition-colors cursor-default">
              {col}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
