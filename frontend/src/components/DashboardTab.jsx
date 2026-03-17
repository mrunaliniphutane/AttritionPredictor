import React, { useEffect, useState } from 'react'
import { fetchDashboard, formatINR, formatPct } from '../utils/api'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'

const COLORS = ['#D4A843', '#34D399', '#FB7185', '#60A5FA', '#A78BFA', '#FBBF24', '#F97316', '#2DD4BF']

function KPI({ label, value, sub, color }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: color || '#fff' }}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}

export default function DashboardTab({ dataId, uploadData }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState([])

  const load = async (depts) => {
    setLoading(true)
    try {
      const d = await fetchDashboard(dataId, depts)
      setData(d)
    } catch (e) {
      toast.error('Dashboard failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load([]) }, [dataId])

  const allDepts = data?.all_depts || []
  const { kpi } = data || {}

  const toggleDept = (d) => {
    const next = selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d]
    setSelected(next)
    load(next)
  }

  return (
    <div className="space-y-6">
      {/* Dept filter */}
      {allDepts.length > 0 && (
        <div className="card">
          <div className="text-sm font-semibold text-white mb-3">🏢 Filter by Department</div>
          <div className="flex flex-wrap gap-2">
            {allDepts.map(d => (
              <button
                key={d}
                onClick={() => toggleDept(d)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${selected.includes(d) ? 'bg-gold text-bg' : 'bg-border text-muted hover:text-white'}`}
              >
                {d}
              </button>
            ))}
            {selected.length > 0 && (
              <button onClick={() => { setSelected([]); load([]) }} className="px-3 py-1 rounded-lg text-xs text-muted hover:text-danger border border-border">
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <div className="grid grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-20" />)}</div>}

      {kpi && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            <KPI label="Total Employees" value={kpi.total_employees} />
            <KPI label="Attrition Rate" value={formatPct(kpi.attrition_rate)} color="#FB7185" />
            <KPI label="Attritioned" value={kpi.attritioned} color="#FB7185" />
            <KPI label="Retained" value={kpi.retained} color="#34D399" />
            {kpi.avg_income && <KPI label="Avg Income" value={formatINR(kpi.avg_income)} color="#D4A843" />}
            {kpi.avg_age && <KPI label="Avg Age" value={kpi.avg_age?.toFixed(1) + ' yrs'} />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Chart 1: Dept attrition */}
            {data.dept_attrition?.length > 0 && (
              <div className="card">
                <div className="section-title">📊 Attrition by Department</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.dept_attrition} margin={{ bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                    <XAxis dataKey="dept" tick={{ fontSize: 9, fill: '#8899BB' }} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: '#8899BB' }} />
                    <Tooltip contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                    <Legend />
                    <Bar dataKey="attrited" name="Attrited" fill="#FB7185" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="total" name="Total" fill="#2A3F6A" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Chart 2: Role attrition */}
            {data.role_attrition?.length > 0 && (
              <div className="card">
                <div className="section-title">👔 Attrition by Job Role</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.role_attrition} layout="vertical" margin={{ left: 130 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#8899BB' }} />
                    <YAxis dataKey="role" type="category" tick={{ fontSize: 9, fill: '#8899BB' }} width={125} />
                    <Tooltip contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                    <Bar dataKey="attrited" name="Attrited" fill="#FBBF24" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Chart 3: Income dist */}
            {data.income_dist?.length > 0 && (
              <div className="card">
                <div className="section-title">💰 Avg Income by Department</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.income_dist} margin={{ bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                    <XAxis dataKey="dept" tick={{ fontSize: 9, fill: '#8899BB' }} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: '#8899BB' }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                    <Tooltip formatter={v => ['₹' + Number(v).toLocaleString('en-IN'), 'Income']} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                    <Bar dataKey="mean" name="Avg" fill="#D4A843" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="median" name="Median" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Chart 4: Satisfaction */}
            {data.satisfaction?.length > 0 && data.satisfaction_cols?.length > 0 && (
              <div className="card overflow-x-auto">
                <div className="section-title">😊 Satisfaction Heatmap by Dept</div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-muted py-2 px-2">Dept</th>
                      {data.satisfaction_cols.map(c => <th key={c} className="text-muted py-2 px-2 text-center">{c.replace('Satisfaction', '').replace('Score', '')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.satisfaction.map(row => (
                      <tr key={row.dept}>
                        <td className="text-white font-medium py-1.5 px-2 border-b border-border">{row.dept}</td>
                        {data.satisfaction_cols.map(c => {
                          const v = row[c]
                          const color = v >= 3.5 ? '#34D399' : v >= 2.5 ? '#FBBF24' : '#FB7185'
                          return <td key={c} className="text-center py-1.5 px-2 border-b border-border font-mono" style={{ color }}>{v?.toFixed(2) || '—'}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Chart 5: Overtime stacked */}
            {data.overtime_stacked?.length > 0 && (
              <div className="card">
                <div className="section-title">⏰ OverTime by Department</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.overtime_stacked} margin={{ bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                    <XAxis dataKey="dept" tick={{ fontSize: 9, fill: '#8899BB' }} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: '#8899BB' }} />
                    <Tooltip contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                    <Legend />
                    {Object.keys(data.overtime_stacked[0] || {}).filter(k => k !== 'dept').map((k, i) => (
                      <Bar key={k} dataKey={k} name={k} stackId="a" fill={k === 'Yes' ? '#FB7185' : '#34D399'} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Chart 6: Tenure */}
            {data.tenure_chart?.length > 0 && (
              <div className="card">
                <div className="section-title">📅 Attrition by Tenure Band</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.tenure_chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                    <XAxis dataKey="tenure_group" tick={{ fontSize: 10, fill: '#8899BB' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#8899BB' }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={v => [`${Number(v).toFixed(2)}%`, 'Attrition']} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                    <Bar dataKey="attrition_rate" name="Attrition Rate" radius={[4, 4, 0, 0]}>
                      {data.tenure_chart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Chart 7: Age histogram */}
            {data.age_histogram?.length > 0 && (
              <div className="card">
                <div className="section-title">👴 Age Distribution</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.age_histogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                    <XAxis dataKey="age_range" tick={{ fontSize: 10, fill: '#8899BB' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#8899BB' }} />
                    <Tooltip contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px' }} />
                    <Bar dataKey="count" name="Employees" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
