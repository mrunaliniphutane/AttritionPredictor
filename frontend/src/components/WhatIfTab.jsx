import React, { useState, useEffect } from 'react'
import { predictEmployee, fetchMetadata } from '../utils/api'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

// Gauge SVG component
function GaugeChart({ value }) {
  const pct = Math.min(Math.max(value, 0), 100)
  const angle = -135 + (pct / 100) * 270
  const rad = (a) => (a * Math.PI) / 180
  const cx = 80, cy = 80, r = 60
  const color = pct < 30 ? '#34D399' : pct < 60 ? '#FBBF24' : '#FB7185'
  
  const arcPath = (start, end) => {
    const s = { x: cx + r * Math.cos(rad(start)), y: cy + r * Math.sin(rad(start)) }
    const e = { x: cx + r * Math.cos(rad(end)), y: cy + r * Math.sin(rad(end)) }
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const needleX = cx + (r - 15) * Math.cos(rad(angle))
  const needleY = cy + (r - 15) * Math.sin(rad(angle))

  return (
    <svg viewBox="0 0 160 120" className="w-48">
      <path d={arcPath(-135, -45)} fill="none" stroke="#34D399" strokeWidth="12" strokeOpacity="0.3" />
      <path d={arcPath(-45, 45)} fill="none" stroke="#FBBF24" strokeWidth="12" strokeOpacity="0.3" />
      <path d={arcPath(45, 135)} fill="none" stroke="#FB7185" strokeWidth="12" strokeOpacity="0.3" />
      <path d={arcPath(-135, angle)} fill="none" stroke={color} strokeWidth="12" />
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="white" />
      <text x={cx} y={cy + 22} textAnchor="middle" fill={color} fontSize="18" fontWeight="800">{pct.toFixed(0)}%</text>
      <text x={cx} y={cy + 36} textAnchor="middle" fill="#8899BB" fontSize="9">Attrition Risk</text>
    </svg>
  )
}

// Human-readable labels for common feature names
const LABELS = {
  Age: 'Age', MonthlyIncome: 'Monthly Income (₹)', YearsAtCompany: 'Years at Company',
  DistanceFromHome: 'Distance from Home (km)', JobSatisfaction: 'Job Satisfaction',
  WorkLifeBalance: 'Work-Life Balance', EnvironmentSatisfaction: 'Environment Satisfaction',
  RelationshipSatisfaction: 'Relationship Satisfaction', TrainingTimesLastYear: 'Training Times Last Year',
  YearsSinceLastPromotion: 'Years Since Last Promotion', NumCompaniesWorked: 'Companies Worked',
  TotalWorkingYears: 'Total Working Years', Department: 'Department', OverTime: 'OverTime',
  BusinessTravel: 'Business Travel', MaritalStatus: 'Marital Status', JobRole: 'Job Role',
  Gender: 'Gender', EducationField: 'Education Field', Grade: 'Grade', JobLevel: 'Job Level',
}

export default function WhatIfTab({ dataId, trainResult, uploadData }) {
  const [meta, setMeta] = useState(null)
  const [vals, setVals] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)

  // Load metadata when training completes
  useEffect(() => {
    if (!trainResult) return
    setMetaLoading(true)
    fetchMetadata(dataId)
      .then(data => {
        setMeta(data)
        // Set initial values: median for numeric, first option for categorical
        const init = {}
        for (const f of data.fields) {
          if (f.type === 'numeric') {
            init[f.name] = f.median
          } else {
            init[f.name] = f.default || f.options?.[0] || ''
          }
        }
        setVals(init)
      })
      .catch(e => toast.error('Metadata load failed: ' + (e.response?.data?.error || e.message)))
      .finally(() => setMetaLoading(false))
  }, [dataId, trainResult])

  if (!trainResult) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-5xl">🎯</div>
        <p className="text-muted">Please train models first (Models tab)</p>
      </div>
    )
  }

  if (metaLoading || !meta) {
    return <div className="space-y-4"><div className="skeleton h-20" /><div className="skeleton h-64" /></div>
  }

  const numericFields = meta.fields.filter(f => f.type === 'numeric')
  const categoricalFields = meta.fields.filter(f => f.type === 'categorical')

  const handlePredict = async () => {
    setLoading(true)
    try {
      const payload = { ...vals }
      const data = await predictEmployee(dataId, payload)
      setResult(data)
    } catch (e) {
      toast.error('Prediction failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setLoading(false)
    }
  }

  const shapData = result?.shap_contributions?.slice(0, 12).map(s => ({
    feature: s.feature,
    shap: s.value,
  })) || []

  const getLabel = (name) => LABELS[name] || name.replace(/([A-Z])/g, ' $1').trim()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="card space-y-4">
          <div className="section-title">⚙️ Employee Parameters</div>

          {/* Numeric Sliders */}
          {numericFields.map(f => {
            const cur = vals[f.name] ?? f.median
            const range = f.max - f.min || 1
            return (
              <div key={f.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">{getLabel(f.name)}</span>
                  <span className="text-gold font-semibold font-mono">
                    {f.name.toLowerCase().includes('income') || f.name.toLowerCase().includes('salary')
                      ? '₹' + Number(cur).toLocaleString('en-IN')
                      : Number(cur).toFixed(f.step < 1 ? 1 : 0)}
                  </span>
                </div>
                <input
                  type="range" min={f.min} max={f.max} step={f.step}
                  value={cur}
                  onChange={e => setVals(v => ({ ...v, [f.name]: Number(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #D4A843 0%, #D4A843 ${((cur - f.min) / range) * 100}%, #2A3F6A ${((cur - f.min) / range) * 100}%, #2A3F6A 100%)`
                  }}
                />
              </div>
            )
          })}

          {/* Categorical Dropdowns */}
          {categoricalFields.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {categoricalFields.map(f => (
                <div key={f.name}>
                  <div className="text-xs text-muted mb-1">{getLabel(f.name)}</div>
                  <select
                    value={vals[f.name] || f.default}
                    onChange={e => setVals(v => ({ ...v, [f.name]: e.target.value }))}
                    className="select-field text-xs"
                  >
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          <button onClick={handlePredict} disabled={loading} className="btn-gold w-full mt-2 flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" /> Predicting…</> : '🎯 Predict Attrition Risk'}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Gauge */}
              <div className="card flex flex-col items-center gap-3">
                <GaugeChart value={result.probability * 100} />
                <div className={`badge text-sm font-bold px-4 py-1.5 ${
                  result.risk_category === 'Low' ? 'badge-low' :
                  result.risk_category === 'Medium' ? 'badge-medium' :
                  result.risk_category === 'High' ? 'badge-high' : 'badge-critical'
                }`}>
                  {result.risk_category} Risk
                </div>
              </div>

              {/* Risk / Retention */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
                  <div className="text-xs font-semibold text-danger mb-2">⬆️ Risk Drivers</div>
                  {result.risk_factors.length > 0
                    ? result.risk_factors.map(f => <div key={f} className="text-xs text-muted py-0.5">• {f}</div>)
                    : <div className="text-xs text-muted">None significant</div>}
                </div>
                <div className="bg-success/10 border border-success/20 rounded-xl p-3">
                  <div className="text-xs font-semibold text-success mb-2">⬇️ Retention Factors</div>
                  {result.retention_factors.length > 0
                    ? result.retention_factors.map(f => <div key={f} className="text-xs text-muted py-0.5">• {f}</div>)
                    : <div className="text-xs text-muted">None identified</div>}
                </div>
              </div>

              {/* Recommendations */}
              <div className="card">
                <div className="text-sm font-semibold text-gold mb-3">📋 Retention Recommendations</div>
                <ul className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="text-xs text-muted flex gap-2">
                      <span className="text-gold mt-0.5">→</span>
                      <span dangerouslySetInnerHTML={{ __html: r.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                    </li>
                  ))}
                </ul>
              </div>

              {/* SHAP bars */}
              {shapData.length > 0 && (
                <div className="card">
                  <div className="text-sm font-semibold text-white mb-3">🔍 SHAP Feature Contributions</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={shapData} layout="vertical" margin={{ left: 140 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#8899BB' }} />
                      <YAxis dataKey="feature" type="category" tick={{ fontSize: 9, fill: '#8899BB' }} width={135} />
                      <Tooltip formatter={v => [v.toFixed(4), 'SHAP']} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                      <ReferenceLine x={0} stroke="#2A3F6A" />
                      <Bar dataKey="shap" radius={[0, 4, 4, 0]}>
                        {shapData.map((d, i) => <Cell key={i} fill={d.shap >= 0 ? '#FB7185' : '#34D399'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="text-5xl opacity-40">🎯</div>
              <p className="text-muted text-sm">Configure parameters and click Predict</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
