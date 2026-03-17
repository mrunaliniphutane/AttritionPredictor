import React, { useState, useEffect } from 'react'
import { fetchSHAPGlobal, fetchSHAPIndividual } from '../utils/api'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

function WaterfallBar({ data }) {
  if (!data || data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 160 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#8899BB' }} tickFormatter={v => v.toFixed(3)} />
        <YAxis dataKey="feature" type="category" tick={{ fontSize: 10, fill: '#8899BB' }} width={155} />
        <Tooltip formatter={(v) => [v.toFixed(4), 'SHAP Value']} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px', fontSize: '12px' }} />
        <ReferenceLine x={0} stroke="#2A3F6A" strokeWidth={1} />
        <Bar dataKey="shap" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.shap >= 0 ? '#FB7185' : '#34D399'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function SHAPTab({ dataId, trainResult, columns }) {
  const [globalData, setGlobalData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [empIdx, setEmpIdx] = useState(0)
  const [indivData, setIndivData] = useState(null)
  const [indivLoading, setIndivLoading] = useState(false)

  useEffect(() => {
    if (!trainResult) return
    setLoading(true)
    fetchSHAPGlobal(dataId)
      .then(setGlobalData)
      .catch(e => toast.error('SHAP global failed: ' + (e.response?.data?.error || e.message)))
      .finally(() => setLoading(false))
  }, [dataId, trainResult])

  const loadIndividual = async (idx) => {
    setIndivLoading(true)
    try {
      const d = await fetchSHAPIndividual(dataId, idx)
      setIndivData(d)
    } catch (e) {
      toast.error('Individual SHAP failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setIndivLoading(false)
    }
  }

  if (!trainResult) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-5xl">🔍</div>
        <p className="text-muted">Please train models first (Models tab)</p>
      </div>
    )
  }

  const globalBarData = globalData
    ? globalData.features.map((f, i) => ({ feature: f, importance: globalData.values[i] })).slice(0, 15)
    : []

  const waterfallData = indivData
    ? indivData.waterfall.features.map((f, i) => ({ feature: f, shap: indivData.waterfall.shap_values[i] }))
    : []

  return (
    <div className="space-y-6">
      {/* Global SHAP */}
      <div className="card">
        <div className="section-title">🌍 Global Feature Importance (SHAP)</div>
        {loading ? (
          <div className="skeleton h-64 w-full" />
        ) : globalBarData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={globalBarData} layout="vertical" margin={{ left: 180 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8899BB' }} />
                <YAxis dataKey="feature" type="category" tick={{ fontSize: 10, fill: '#8899BB' }} width={175} />
                <Tooltip formatter={(v) => [v.toFixed(4), 'Mean |SHAP|']} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {globalBarData.map((_, i) => (
                    <Cell key={i} fill={`hsl(${42 + i * 8}, 80%, ${65 - i * 2}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Business Insights */}
            {globalData.insights && (
              <div className="mt-5 space-y-3">
                <div className="text-sm font-semibold text-gold">💡 Auto-Generated Business Insights</div>
                {globalData.insights.map((ins, i) => (
                  <div key={i} className="bg-card-dark border border-border rounded-xl p-3 text-sm text-muted leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: ins.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-muted text-center py-10">No SHAP data available</div>
        )}
      </div>

      {/* Individual SHAP */}
      <div className="card">
        <div className="section-title">👤 Individual Employee SHAP Explanation</div>
        <div className="flex gap-3 mb-5 flex-wrap">
          <input
            type="number"
            min="0"
            value={empIdx}
            onChange={e => setEmpIdx(Number(e.target.value))}
            className="input-field w-32"
            placeholder="Index"
          />
          <button
            onClick={() => loadIndividual(empIdx)}
            disabled={indivLoading}
            className="btn-gold text-sm"
          >
            {indivLoading ? '⏳ Loading…' : '🔍 Explain Employee'}
          </button>
        </div>

        {indivLoading && <div className="skeleton h-64 w-full" />}

        {indivData && !indivLoading && (
          <div className="space-y-5">
            {/* Risk header */}
            <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
              indivData.attrition_probability >= 0.6
                ? 'bg-danger/10 border-danger/30'
                : indivData.attrition_probability >= 0.3
                  ? 'bg-warning/10 border-warning/30'
                  : 'bg-success/10 border-success/30'
            }`}>
              <div className="text-4xl font-black"
                style={{ color: indivData.attrition_probability >= 0.6 ? '#FB7185' : indivData.attrition_probability >= 0.3 ? '#FBBF24' : '#34D399' }}>
                {(indivData.attrition_probability * 100).toFixed(1)}%
              </div>
              <div>
                <div className="font-semibold text-white">Employee #{empIdx} — {indivData.risk_level} Risk</div>
                <div className="text-sm text-muted mt-0.5">{indivData.explanation}</div>
                {indivData.actual !== null && (
                  <div className="text-xs mt-1 text-muted">Actual: <span className={indivData.actual === 1 ? 'text-danger' : 'text-success'}>{indivData.actual === 1 ? 'Left' : 'Stayed'}</span></div>
                )}
              </div>
            </div>

            {/* Risk / Retention factors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
                <div className="text-xs font-semibold text-danger mb-2">⬆️ Risk Factors (push toward leaving)</div>
                {indivData.risk_factors.length > 0
                  ? indivData.risk_factors.map(f => <div key={f} className="text-xs text-muted py-0.5">• {f}</div>)
                  : <div className="text-xs text-muted">None identified</div>}
              </div>
              <div className="bg-success/10 border border-success/20 rounded-xl p-4">
                <div className="text-xs font-semibold text-success mb-2">⬇️ Retention Factors (push to stay)</div>
                {indivData.retention_factors.length > 0
                  ? indivData.retention_factors.map(f => <div key={f} className="text-xs text-muted py-0.5">• {f}</div>)
                  : <div className="text-xs text-muted">None identified</div>}
              </div>
            </div>

            {/* Waterfall */}
            <div>
              <div className="text-sm font-semibold text-white mb-3">SHAP Waterfall — Feature Contributions</div>
              <div className="text-xs text-muted mb-2">🔴 Red = pushes toward attrition &nbsp;|&nbsp; 🟢 Green = pushes toward retention</div>
              <WaterfallBar data={waterfallData} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
