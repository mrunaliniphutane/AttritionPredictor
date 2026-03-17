import React, { useEffect, useState, useMemo } from 'react'
import { fetchRiskScoring, riskColor, riskBadgeClass } from '../utils/api'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

const RISK_CATS = ['Low', 'Medium', 'High', 'Critical']
const CAT_COLORS = { Low: '#34D399', Medium: '#FBBF24', High: '#F97316', Critical: '#FB7185' }

export default function RiskScoringTab({ dataId, trainResult }) {
  // ── ALL hooks must be called unconditionally BEFORE any early returns ──
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sortCol, setSortCol] = useState('risk_score')
  const [sortDir, setSortDir] = useState('desc')
  const [filterCat, setFilterCat] = useState('All')

  useEffect(() => {
    if (!trainResult) return
    setLoading(true)
    fetchRiskScoring(dataId)
      .then(setData)
      .catch(e => toast.error('Risk scoring failed: ' + (e.response?.data?.error || e.message)))
      .finally(() => setLoading(false))
  }, [dataId, trainResult])

  // useMemo must also be above early returns
  const employees = data?.employees || []
  const tableData = useMemo(() => {
    let rows = employees
    if (filterCat !== 'All') rows = rows.filter(r => r.risk_category === filterCat)
    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? 0
      const bv = b[sortCol] ?? 0
      return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1)
    })
  }, [employees, sortCol, sortDir, filterCat])

  // ── Early returns AFTER all hooks ──
  if (!trainResult) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-5xl">⚠️</div>
        <p className="text-muted">Please train models first (Models tab)</p>
      </div>
    )
  }

  if (loading) return <div className="space-y-4"><div className="skeleton h-20" /><div className="skeleton h-64" /></div>
  if (!data) return null

  const { total, category_counts, dept_distribution, avg_risk, high_risk_count } = data

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  // Pie data
  const pieData = RISK_CATS.filter(c => category_counts?.[c]).map(c => ({
    name: c, value: category_counts[c], color: CAT_COLORS[c]
  }))

  // Dept stacked bar data
  const deptBarData = dept_distribution?.depts?.map((dept, di) => {
    const row = { dept }
    dept_distribution.categories.forEach((cat, ci) => {
      row[cat] = dept_distribution.counts[di]?.[ci] || 0
    })
    return row
  }) || []

  // CSV download
  const downloadCSV = () => {
    if (!employees.length) return
    const headers = Object.keys(employees[0])
    const csv = [headers.join(','), ...employees.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'attrition_risk_scores.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const cols = employees?.[0] ? Object.keys(employees[0]) : []

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="metric-label">Total Scored</div>
          <div className="metric-value gradient-text">{total}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Risk Score</div>
          <div className="metric-value text-warning">{avg_risk}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">High/Critical Risk</div>
          <div className="metric-value text-danger">{high_risk_count}</div>
          <div className="text-xs text-muted">{total ? ((high_risk_count / total) * 100).toFixed(1) : 0}% of total</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Critical</div>
          <div className="metric-value text-danger">{category_counts?.['Critical'] || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="card flex flex-col items-center">
            <div className="section-title">🥧 Risk Category Distribution</div>
            <PieChart width={240} height={200}>
              <Pie data={pieData} cx={120} cy={95} innerRadius={55} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
            </PieChart>
            <div className="flex gap-4 mt-2">
              {pieData.map(d => (
                <span key={d.name} className="flex items-center gap-1 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: d.color }} />
                  <span className="text-muted">{d.name}: </span>
                  <span className="text-white">{d.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dept stacked bar */}
        {deptBarData.length > 0 && (
          <div className="card">
            <div className="section-title">🏢 Risk by Department</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptBarData} margin={{ bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                <XAxis dataKey="dept" tick={{ fontSize: 9, fill: '#8899BB' }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: '#8899BB' }} />
                <Tooltip contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                <Legend />
                {dept_distribution.categories.map(cat => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={CAT_COLORS[cat] || '#8899BB'} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Employee risk table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="section-title mb-0">👥 High-Risk Employee Table (Top 100)</div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1">
              {['All', ...RISK_CATS].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${filterCat === cat ? 'bg-gold text-bg' : 'bg-border text-muted hover:text-white'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button onClick={downloadCSV} className="btn-outline text-xs flex items-center gap-1">
              ⬇️ CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs data-table">
            <thead>
              <tr className="border-b border-border">
                {cols.map(col => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="text-left text-muted py-2 px-3 font-medium cursor-pointer hover:text-gold transition-colors whitespace-nowrap select-none"
                  >
                    {col} {sortCol === col ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={i} className="border-b border-border/40 transition-colors">
                  {cols.map(col => (
                    <td key={col} className="py-2 px-3">
                      {col === 'risk_category' ? (
                        <span className={riskBadgeClass(row[col])}>{row[col]}</span>
                      ) : col === 'risk_score' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${row[col]}%`, background: riskColor(row['risk_category']) }}
                            />
                          </div>
                          <span className="font-mono font-semibold" style={{ color: riskColor(row['risk_category']) }}>
                            {row[col]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">{row[col] ?? '—'}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr><td colSpan={cols.length} className="text-center text-muted py-8">No employees match filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
