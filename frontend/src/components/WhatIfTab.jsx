import React, { useState } from 'react'
import { predictEmployee } from '../utils/api'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

// Gauge SVG component
function GaugeChart({ value }) {
  const pct = Math.min(Math.max(value, 0), 100)
  const angle = -135 + (pct / 100) * 270
  const rad = (a) => (a * Math.PI) / 180
  const cx = 80, cy = 80, r = 60
  const color = pct < 30 ? '#34D399' : pct < 60 ? '#FBBF24' : '#FB7185'
  
  const arcPath = (start, end, color) => {
    const s = { x: cx + r * Math.cos(rad(start)), y: cy + r * Math.sin(rad(start)) }
    const e = { x: cx + r * Math.cos(rad(end)), y: cy + r * Math.sin(rad(end)) }
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const needleX = cx + (r - 15) * Math.cos(rad(angle - 90 + 90))
  const needleY = cy + (r - 15) * Math.sin(rad(angle - 90 + 90))

  return (
    <svg viewBox="0 0 160 120" className="w-48">
      <path d={arcPath(-135, -45, '#34D399')} fill="none" stroke="#34D399" strokeWidth="12" strokeOpacity="0.3" />
      <path d={arcPath(-45, 45, '#FBBF24')} fill="none" stroke="#FBBF24" strokeWidth="12" strokeOpacity="0.3" />
      <path d={arcPath(45, 135, '#FB7185')} fill="none" stroke="#FB7185" strokeWidth="12" strokeOpacity="0.3" />
      <path d={arcPath(-135, angle - 90 + 90, color)} fill="none" stroke={color} strokeWidth="12" />
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="white" />
      <text x={cx} y={cy + 22} textAnchor="middle" fill={color} fontSize="18" fontWeight="800">{pct.toFixed(0)}%</text>
      <text x={cx} y={cy + 36} textAnchor="middle" fill="#8899BB" fontSize="9">Attrition Risk</text>
    </svg>
  )
}

const DEPTS = ['Engineering', 'Sales', 'HR', 'Finance', 'Marketing', 'Operations', 'IT', 'Legal', 'R&D', 'Supply Chain']
const GRADES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'M1', 'M2', 'Director', 'VP']
const JOB_ROLES = ['Software Engineer', 'Sales Executive', 'Manager', 'Analyst', 'HR Executive', 'Data Scientist', 'Team Lead', 'Senior Engineer', 'Director', 'Associate']
const TRAVEL = ['Non-Travel', 'Travel_Rarely', 'Travel_Frequently']
const MARITAL = ['Single', 'Married', 'Divorced']

const SLIDERS = [
  { key: 'Age', label: 'Age', min: 18, max: 60, step: 1, default: 32 },
  { key: 'MonthlyIncome', label: 'Monthly Income (₹)', min: 10000, max: 200000, step: 1000, default: 50000 },
  { key: 'YearsAtCompany', label: 'Years at Company', min: 0, max: 40, step: 1, default: 5 },
  { key: 'DistanceFromHome', label: 'Distance from Home (km)', min: 1, max: 100, step: 1, default: 10 },
  { key: 'JobSatisfaction', label: 'Job Satisfaction (1-4)', min: 1, max: 4, step: 1, default: 3 },
  { key: 'WorkLifeBalance', label: 'Work-Life Balance (1-4)', min: 1, max: 4, step: 1, default: 3 },
  { key: 'EnvironmentSatisfaction', label: 'Environment Satisfaction (1-4)', min: 1, max: 4, step: 1, default: 3 },
  { key: 'RelationshipSatisfaction', label: 'Relationship Satisfaction (1-4)', min: 1, max: 4, step: 1, default: 3 },
  { key: 'TrainingTimesLastYear', label: 'Training Times Last Year', min: 0, max: 6, step: 1, default: 2 },
  { key: 'YearsSinceLastPromotion', label: 'Years Since Last Promotion', min: 0, max: 15, step: 1, default: 2 },
  { key: 'NumCompaniesWorked', label: 'Num Companies Worked', min: 0, max: 9, step: 1, default: 2 },
  { key: 'TotalWorkingYears', label: 'Total Working Years', min: 0, max: 40, step: 1, default: 10 },
]

export default function WhatIfTab({ dataId, trainResult, uploadData }) {
  const [vals, setVals] = useState(Object.fromEntries(SLIDERS.map(s => [s.key, s.default])))
  const [selects, setSelects] = useState({
    Department: DEPTS[0],
    Grade: GRADES[0],
    JobRole: JOB_ROLES[0],
    OverTime: 'No',
    BusinessTravel: TRAVEL[0],
    MaritalStatus: MARITAL[0],
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  if (!trainResult) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-5xl">🎯</div>
        <p className="text-muted">Please train models first (Models tab)</p>
      </div>
    )
  }

  const handlePredict = async () => {
    setLoading(true)
    try {
      const payload = { ...vals, ...selects }
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="card space-y-4">
          <div className="section-title">⚙️ Employee Parameters</div>

          {/* Sliders */}
          {SLIDERS.map(s => (
            <div key={s.key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">{s.label}</span>
                <span className="text-gold font-semibold font-mono">
                  {s.key === 'MonthlyIncome' ? '₹' + Number(vals[s.key]).toLocaleString('en-IN') : vals[s.key]}
                </span>
              </div>
              <input
                type="range" min={s.min} max={s.max} step={s.step}
                value={vals[s.key]}
                onChange={e => setVals(v => ({ ...v, [s.key]: Number(e.target.value) }))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #D4A843 0%, #D4A843 ${((vals[s.key] - s.min) / (s.max - s.min)) * 100}%, #2A3F6A ${((vals[s.key] - s.min) / (s.max - s.min)) * 100}%, #2A3F6A 100%)`
                }}
              />
            </div>
          ))}

          {/* Dropdowns */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { key: 'Department', opts: DEPTS },
              { key: 'Grade', opts: GRADES },
              { key: 'JobRole', opts: JOB_ROLES },
              { key: 'OverTime', opts: ['Yes', 'No'] },
              { key: 'BusinessTravel', opts: TRAVEL },
              { key: 'MaritalStatus', opts: MARITAL },
            ].map(({ key, opts }) => (
              <div key={key}>
                <div className="text-xs text-muted mb-1">{key}</div>
                <select
                  value={selects[key]}
                  onChange={e => setSelects(v => ({ ...v, [key]: e.target.value }))}
                  className="select-field text-xs"
                >
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

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
