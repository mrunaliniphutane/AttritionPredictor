import React, { useState } from 'react'
import { trainModels } from '../utils/api'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'

const MODEL_COLORS = { 'Random Forest': '#D4A843', 'XGBoost': '#34D399', 'Logistic Regression': '#60A5FA' }

export default function ModelsTab({ dataId, trainResult, setTrainResult }) {
  const [loading, setLoading] = useState(false)
  const [selectedCM, setSelectedCM] = useState(null)

  const handleTrain = async () => {
    setLoading(true)
    try {
      toast.loading('Training models… (may take 1-2 minutes)', { id: 'train' })
      const result = await trainModels(dataId)
      setTrainResult(result)
      setSelectedCM(result.best_model)
      toast.success(`✅ Training complete! Best model: ${result.best_model}`, { id: 'train' })
    } catch (e) {
      toast.error('Training failed: ' + (e.response?.data?.error || e.message), { id: 'train' })
    } finally {
      setLoading(false)
    }
  }

  const metrics = trainResult?.metrics || {}
  const bestModel = trainResult?.best_model

  const metricRows = ['Accuracy', 'Precision', 'Recall', 'F1', 'AUC_ROC']

  // ROC data for overlay chart
  const rocData = []
  if (metrics) {
    const lengths = Object.values(metrics).map(m => m.roc?.fpr?.length || 0)
    const maxLen = Math.max(...lengths, 0)
    for (let i = 0; i < Math.min(maxLen, 100); i++) {
      const step = { fpr: 0 }
      Object.entries(metrics).forEach(([name, m]) => {
        const idx = Math.floor(i * m.roc.fpr.length / Math.min(maxLen, 100))
        step.fpr = m.roc.fpr[idx] || 0
        step[name] = m.roc.tpr[idx] || 0
      })
      rocData.push(step)
    }
  }

  const cm = selectedCM && metrics[selectedCM] ? metrics[selectedCM].confusion_matrix : null

  return (
    <div className="space-y-6">
      {/* Train button */}
      <div className="card flex flex-col items-center gap-4 py-8">
        <div className="text-4xl">🤖</div>
        <div className="text-center">
          <h3 className="text-white font-bold text-lg mb-1">Train All Models</h3>
          <p className="text-muted text-sm">Random Forest · XGBoost · Logistic Regression with SMOTE + RandomizedSearchCV</p>
        </div>
        <button
          onClick={handleTrain}
          disabled={loading}
          className="btn-gold flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
              Training…
            </>
          ) : (
            <>{trainResult ? '🔄 Retrain Models' : '🚀 Train Models'}</>
          )}
        </button>
        {loading && (
          <div className="text-xs text-muted animate-pulse">
            Applying SMOTE · Tuning hyperparameters · Evaluating on test set…
          </div>
        )}
      </div>

      {trainResult && (
        <>
          {/* Best model badge */}
          <div className="flex items-center gap-3 p-4 bg-gold/10 border border-gold/30 rounded-2xl">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="text-xs text-muted">Best Model (by AUC-ROC)</div>
              <div className="text-gold font-bold text-lg">{bestModel}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-muted">AUC-ROC</div>
              <div className="text-white font-bold">{metrics[bestModel]?.AUC_ROC?.toFixed(4)}</div>
            </div>
          </div>

          {/* Metrics comparison table */}
          <div className="card overflow-x-auto">
            <div className="section-title">📊 Model Performance Comparison</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted py-2 pr-4 font-medium">Metric</th>
                  {Object.keys(metrics).map(name => (
                    <th key={name} className={`text-center py-2 px-4 font-medium ${name === bestModel ? 'text-gold' : 'text-muted'}`}>
                      {name === bestModel ? '🏆 ' : ''}{name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricRows.map(metric => (
                  <tr key={metric} className="border-b border-border/50 hover:bg-border/20 transition-colors">
                    <td className="py-2.5 pr-4 text-muted font-medium">{metric.replace('_', '-')}</td>
                    {Object.entries(metrics).map(([name, m]) => {
                      const val = m[metric]
                      const isBest = name === bestModel
                      const isTopForMetric = Object.values(metrics).every(om => (om[metric] || 0) <= (val || 0))
                      return (
                        <td key={name} className={`text-center py-2.5 px-4 font-mono font-semibold ${isBest ? 'text-gold' : isTopForMetric ? 'text-success' : 'text-white'}`}>
                          {val !== undefined ? (val * 100).toFixed(2) + '%' : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ROC Curves */}
          {rocData.length > 0 && (
            <div className="card">
              <div className="section-title">📈 ROC Curves Overlay</div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={rocData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6A" />
                  <XAxis dataKey="fpr" tickFormatter={v => v.toFixed(2)} label={{ value: 'FPR', position: 'insideBottom', offset: -5, fill: '#8899BB', fontSize: 12 }} tick={{ fontSize: 10, fill: '#8899BB' }} />
                  <YAxis domain={[0, 1]} tickFormatter={v => v.toFixed(1)} label={{ value: 'TPR', angle: -90, position: 'insideLeft', fill: '#8899BB', fontSize: 12 }} tick={{ fontSize: 10, fill: '#8899BB' }} />
                  <Tooltip formatter={(v, n) => [v.toFixed(3), n]} contentStyle={{ background: '#1B2A4A', border: '1px solid #2A3F6A', borderRadius: '12px', fontSize: '12px' }} />
                  <Legend />
                  {/* Diagonal */}
                  <Line dataKey="fpr" stroke="#2A3F6A" dot={false} strokeDasharray="4 4" name="Random" strokeWidth={1} />
                  {Object.keys(metrics).map(name => (
                    <Line key={name} dataKey={name} stroke={MODEL_COLORS[name] || '#8899BB'} dot={false} strokeWidth={2.5} name={`${name} (AUC=${metrics[name].AUC_ROC?.toFixed(3)})`} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Confusion Matrix */}
          <div className="card">
            <div className="section-title">🔲 Confusion Matrix</div>
            <div className="flex gap-3 mb-4">
              {Object.keys(metrics).map(name => (
                <button
                  key={name}
                  onClick={() => setSelectedCM(name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedCM === name ? 'bg-gold text-bg' : 'bg-border text-muted hover:text-white'}`}
                >
                  {name}
                </button>
              ))}
            </div>
            {cm && (
              <div className="flex gap-6 items-center flex-wrap">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'True Negative', val: cm[0][0], color: '#34D399', desc: 'Correctly predicted No' },
                    { label: 'False Positive', val: cm[0][1], color: '#FBBF24', desc: 'Incorrect — predicted Yes' },
                    { label: 'False Negative', val: cm[1][0], color: '#FB7185', desc: 'Missed — predicted No' },
                    { label: 'True Positive', val: cm[1][1], color: '#34D399', desc: 'Correctly predicted Yes' },
                  ].map(cell => (
                    <div key={cell.label} className="w-32 h-24 flex flex-col items-center justify-center rounded-xl border-2 text-center p-2" style={{ borderColor: cell.color + '60', background: cell.color + '15' }}>
                      <div className="text-3xl font-black" style={{ color: cell.color }}>{cell.val}</div>
                      <div className="text-xs font-semibold mt-1" style={{ color: cell.color }}>{cell.label}</div>
                      <div className="text-xs text-muted mt-0.5">{cell.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted space-y-2">
                  <div>Actual \ Predicted →</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-success/60 inline-block" /> Correct predictions</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-warning/60 inline-block" /> False alarm (FP)</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-danger/60 inline-block" /> Missed attrition (FN)</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
