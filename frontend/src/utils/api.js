import axios from 'axios'

const BASE = '/api'

export const uploadFile = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return axios.post(`${BASE}/upload`, fd).then(r => r.data)
}

export const fetchEDA = (id) =>
  axios.get(`${BASE}/eda/${id}`).then(r => r.data)

export const trainModels = (id) =>
  axios.post(`${BASE}/train/${id}`).then(r => r.data)

export const fetchSHAPGlobal = (id) =>
  axios.get(`${BASE}/shap/global/${id}`).then(r => r.data)

export const fetchSHAPIndividual = (id, idx) =>
  axios.get(`${BASE}/shap/individual/${id}/${idx}`).then(r => r.data)

export const predictEmployee = (id, data) =>
  axios.post(`${BASE}/predict/${id}`, data).then(r => r.data)

export const fetchRiskScoring = (id) =>
  axios.get(`${BASE}/risk/${id}`).then(r => r.data)

export const fetchMetadata = (id) =>
  axios.get(`${BASE}/metadata/${id}`).then(r => r.data)

export const fetchDashboard = (id, depts = []) => {
  const q = depts.length ? `?depts=${depts.join(',')}` : ''
  return axios.get(`${BASE}/dashboard/${id}${q}`).then(r => r.data)
}

// Format Indian rupee
export const formatINR = (val) => {
  if (val === null || val === undefined) return '—'
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

// Format percentage  
export const formatPct = (val, decimals = 1) =>
  val !== null && val !== undefined ? `${Number(val).toFixed(decimals)}%` : '—'

// Format number
export const formatNum = (val, decimals = 0) =>
  val !== null && val !== undefined ? Number(val).toFixed(decimals) : '—'

// Risk category color
export const riskColor = (cat) => {
  const map = { Low: '#34D399', Medium: '#FBBF24', High: '#FB923C', Critical: '#FB7185' }
  return map[cat] || '#8899BB'
}

export const riskBadgeClass = (cat) => {
  const map = { Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high', Critical: 'badge-critical' }
  return `badge ${map[cat] || ''}`
}
