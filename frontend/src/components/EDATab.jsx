import React, { useEffect, useState } from 'react'
import { fetchEDA } from '../utils/api'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts'

const COLORS = ['#D4A843', '#34D399', '#FB7185', '#60A5FA', '#A78BFA', '#FBBF24', '#F97316']

function HeatmapCell({ value, min, max }) {
  const pct = max === min ? 0 : (value - min) / (max - min)
  const r = Math.round(251 * (1 - pct) + 52 * pct)
  const g = Math.round(113 * (1 - pct) + 211 * pct)
  const b = Math.round(133 * (1 - pct) + 153 * pct)
  return (
    <td
      className="border border-border text-center text-xs font-mono py-1.5 px-2 transition-all"
      style={{ background: `rgba(${r},${g},${b},0.25)`, color: pct > 0.5 ? '#34D399' : '#FB7185' }}
    >
      {value !== null && value !== undefined ? Number(value).toFixed(2) : '—'}
    </td>
  )
}

export default function EDATab({ dataId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchEDA(dataId)
      .then(setData)
      .catch(e => toast.error('EDA failed: ' + (e.response?.data?.error || e.message)))
      .finally(() => setLoading(false))
  }, [dataId])

  if (loading) return <div className="grid gap-4"><div className="skeleton h-64 w-full" /><div className="skeleton h-48 w-full" /></div>
  if (!data) return null

  const { correlation, attrition_by_dept, attrition_by_grade, attrition_by_overtime, income_by_attrition, satisfaction_heatmap } = data

  const deptData = attrition_by_dept?.labels?.map((l, i) => ({ name: l, rate: attrition_by_dept.values[i] })) || []
  const gradeData = attrition_by_grade?.labels?.map((l, i) => ({ name: l, rate: attrition_by_grade.values[i] })) || []
  const otData = attrition_by_overtime?.labels?.map((l, i) => ({ name: String(l), rate: attrition_by_overtime.values[i] })) || []

  const corrLabels = correlation?.labels || []
  const corrMatrix = correlation?.matrix || []

  const allVals = corrMatrix.flat().filter(v => v !== null && !isNaN(v))
  const minCorr = Math.min(...allVals)
  const maxCorr = Math.max(...allVals)

  return (
    <div className="space-y-6">
      {/* Attrition by Dept */}
      {deptData.length > 0 && (
        <div className="card">
          <div className="section-title">📊 Attrition Rate by Department</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deptData} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8899BB' }} angle={-15} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#8899BB' }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v) => [`${v.toFixed(2)}%`, 'Attrition Rate']} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Attrition by Grade */}
        {gradeData.length > 0 && (
          <div className="card">
            <div className="section-title">📊 Attrition by Grade / Job Level</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8899BB' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8899BB' }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v) => [`${v.toFixed(2)}%`, 'Attrition Rate']} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                <Bar dataKey="rate" fill="#D4A843" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Attrition by OverTime */}
        {otData.length > 0 && (
          <div className="card">
            <div className="section-title">⏰ Attrition by OverTime</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={otData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8899BB' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8899BB' }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v) => [`${v.toFixed(2)}%`, 'Attrition Rate']} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {otData.map((d, i) => <Cell key={i} fill={d.name.toLowerCase() === 'yes' ? '#FB7185' : '#34D399'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Income by Attrition (Boxplot approximation) */}
      {Object.keys(income_by_attrition || {}).length > 0 && (
        <div className="card">
          <div className="section-title">💰 Monthly Income Distribution by Attrition</div>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(income_by_attrition).map(([key, vals]) => {
              const sorted = [...vals].sort((a, b) => a - b)
              const median = sorted[Math.floor(sorted.length / 2)]
              const q1 = sorted[Math.floor(sorted.length / 4)]
              const q3 = sorted[Math.floor(sorted.length * 3 / 4)]
              const min = sorted[0]
              const max = sorted[sorted.length - 1]
              const color = key === 'Yes' || key === '1' ? '#FB7185' : '#34D399'
              return (
                <div key={key} className="bg-card-dark rounded-xl p-4 border border-border">
                  <div className="text-sm font-semibold mb-3" style={{ color }}>
                    {key === 'Yes' || key === '1' ? '🔴 Attrition: Yes' : '🟢 Attrition: No'}
                  </div>
                  <div className="space-y-2 text-xs text-muted">
                    <div className="flex justify-between"><span>Min</span><span className="text-white font-mono">₹{Number(min).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span>Q1</span><span className="text-white font-mono">₹{Number(q1).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span>Median</span><span className="font-bold font-mono" style={{ color }}>₹{Number(median).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span>Q3</span><span className="text-white font-mono">₹{Number(q3).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span>Max</span><span className="text-white font-mono">₹{Number(max).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span>Count</span><span className="text-white font-mono">{vals.length}</span></div>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-3 h-2 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${((median - min) / (max - min)) * 100}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Satisfaction Heatmap */}
      {satisfaction_heatmap?.depts?.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="section-title">😊 Satisfaction Scores Heatmap by Department</div>
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="text-left text-muted py-2 px-3">Department</th>
                {satisfaction_heatmap.features.map(f => (
                  <th key={f} className="text-muted py-2 px-2 text-center font-medium">{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {satisfaction_heatmap.depts.map((dept, di) => (
                <tr key={dept}>
                  <td className="text-white font-medium py-1.5 px-3 border-b border-border">
                    {dept}
                  </td>
                  {satisfaction_heatmap.values[di]?.map((val, vi) => (
                    <HeatmapCell key={vi} value={val} min={1} max={4} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Correlation Matrix */}
      {corrLabels.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="section-title">🔗 Correlation Heatmap (Top Features)</div>
          <div className="text-xs text-muted mb-3">Values close to 1 = strong positive, -1 = strong negative correlation</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="border-collapse" style={{ fontSize: '10px' }}>
              <thead>
                <tr>
                  <th className="text-muted pr-2 text-left py-1 w-28">Feature</th>
                  {corrLabels.map(l => (
                    <th key={l} className="text-muted px-1 py-1 text-center" style={{ minWidth: '60px', maxWidth: '80px', fontSize: '9px', transform: 'rotate(-30deg)', display: 'inline-block', marginTop: '20px' }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corrMatrix.map((row, ri) => (
                  <tr key={ri}>
                    <td className="text-white pr-3 py-0.5 font-medium text-left whitespace-nowrap" style={{ fontSize: '10px' }}>{corrLabels[ri]}</td>
                    {row.map((val, ci) => (
                      <HeatmapCell key={ci} value={val} min={minCorr} max={maxCorr} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
