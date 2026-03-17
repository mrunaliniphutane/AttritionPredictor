import React, { useCallback, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadFile } from '../utils/api'
import toast from 'react-hot-toast'
import Header from './Header'
import Footer from './Footer'

const FEATURES = [
  { icon: '🤖', title: 'Multi-Model AI', desc: 'Random Forest, XGBoost & Logistic Regression with SMOTE balancing and hyperparameter tuning' },
  { icon: '🔍', title: 'SHAP Explainability', desc: 'Global feature importance + individual employee waterfall explanations for transparent AI decisions' },
  { icon: '📈', title: '7 Interactive Dashboards', desc: 'Real-time KPIs, risk scoring, EDA charts, What-If simulator and department analytics' },
]

export default function LandingPage({ onUpload }) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const fileInputRef = useRef(null)

  const processFile = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Please upload an XLSX, XLS, or CSV file')
      return
    }
    setLoading(true)
    setProgress('Uploading dataset…')
    try {
      const data = await uploadFile(file)
      setProgress('Dataset ready!')
      toast.success(`✅ Loaded ${data.rows} employees across ${data.cols} features`)
      onUpload(data)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Connection refused — is Flask running on port 5000?'
      toast.error('Upload failed: ' + msg, { duration: 6000 })
    } finally {
      setLoading(false)
      setProgress('')
    }
  }, [onUpload])

  const onDrop = useCallback((acceptedFiles) => {
    processFile(acceptedFiles[0])
  }, [processFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: loading,
    noClick: false,
    noKeyboard: false,
  })

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-full px-4 py-1.5 mb-6">
            <span className="text-gold text-xs font-semibold tracking-wide uppercase">AI-Powered HR Analytics</span>
          </div>
          <h2 className="text-5xl font-black gradient-text mb-4 leading-tight">
            Predict. Explain. Retain.
          </h2>
          <p className="text-muted text-lg leading-relaxed">
            Upload your HR dataset and get instant AI-powered attrition predictions, SHAP explanations,
            risk scoring and actionable retention recommendations.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={`w-full max-w-xl border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-300
            ${isDragActive ? 'border-gold bg-gold/10 scale-[1.01]' : 'border-border hover:border-gold/60 hover:bg-card/40'}
            ${loading ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className={`text-6xl transition-transform duration-300 ${isDragActive ? 'scale-125' : ''}`}>
              {loading ? '⏳' : isDragActive ? '📂' : '📁'}
            </div>
            {loading ? (
              <>
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                <p className="text-gold font-semibold">{progress}</p>
              </>
            ) : (
              <>
                <p className="text-white text-xl font-bold">
                  {isDragActive ? 'Release to upload' : 'Drop your HR dataset here'}
                </p>
                <p className="text-muted text-sm">KALA_Group_HR_Dataset.xlsx or any CSV</p>
                <div className="flex gap-2 mt-2">
                  {['XLSX', 'XLS', 'CSV'].map(fmt => (
                    <span key={fmt} className="badge bg-border/60 text-muted text-xs px-3 py-1">{fmt}</span>
                  ))}
                </div>
                <button className="btn-gold mt-4 text-sm">
                  Or click to browse files
                </button>
              </>
            )}
          </div>
        </div>

        {/* Privacy badge */}
        <div className="flex items-center gap-2 mt-5 text-xs text-success">
          <span>🔒</span>
          <span>Data never stored on server — processed entirely in-memory</span>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full mt-14">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-hover text-center">
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-white mb-2">{f.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap justify-center gap-8 mt-12 text-center">
          {[
            { val: '3', label: 'ML Models' },
            { val: 'SHAP', label: 'Explainability' },
            { val: '7', label: 'Dashboard Views' },
            { val: '100%', label: 'In-Memory' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl font-black gradient-text">{s.val}</div>
              <div className="text-xs text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
