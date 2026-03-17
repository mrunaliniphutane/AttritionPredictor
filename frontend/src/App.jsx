import React, { useState } from 'react'
import LandingPage from './components/LandingPage'
import Header from './components/Header'
import Footer from './components/Footer'
import TabNav from './components/TabNav'
import OverviewTab from './components/OverviewTab'
import EDATab from './components/EDATab'
import ModelsTab from './components/ModelsTab'
import SHAPTab from './components/SHAPTab'
import WhatIfTab from './components/WhatIfTab'
import DashboardTab from './components/DashboardTab'
import RiskScoringTab from './components/RiskScoringTab'

const TABS = [
  { id: 'overview', label: '🏠 Overview' },
  { id: 'eda', label: '📊 EDA' },
  { id: 'models', label: '🤖 Models' },
  { id: 'shap', label: '🔍 SHAP' },
  { id: 'whatif', label: '🎯 What-If' },
  { id: 'dashboard', label: '📈 Dashboards' },
  { id: 'risk', label: '⚠️ Risk Scoring' },
]

export default function App() {
  const [uploadData, setUploadData] = useState(null) // { id, rows, cols, columns, attrition_split, dept_counts }
  const [activeTab, setActiveTab] = useState('overview')
  const [trainResult, setTrainResult] = useState(null)

  const handleUpload = (data) => {
    setUploadData(data)
    setActiveTab('overview')
    setTrainResult(null)
  }

  if (!uploadData) {
    return <LandingPage onUpload={handleUpload} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Header />
      <div className="flex-1 flex flex-col">
        {/* Upload info bar */}
        <div className="bg-card-dark border-b border-border px-6 py-2 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse-slow inline-block" />
            Dataset active
          </span>
          <span>{uploadData.rows} rows · {uploadData.cols} columns</span>
          {uploadData.attrition_split && (
            <span>
              Attrition: Yes={uploadData.attrition_split['Yes'] ?? uploadData.attrition_split['1'] ?? '—'} /
              No={uploadData.attrition_split['No'] ?? uploadData.attrition_split['0'] ?? '—'}
            </span>
          )}
          <button
            onClick={() => setUploadData(null)}
            className="ml-auto text-muted hover:text-danger transition-colors"
          >
            ✕ Clear dataset
          </button>
        </div>

        {/* Tab navigation */}
        <TabNav tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        <div className="flex-1 px-4 md:px-6 py-6 max-w-[1600px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewTab dataId={uploadData.id} uploadData={uploadData} />
          )}
          {activeTab === 'eda' && (
            <EDATab dataId={uploadData.id} />
          )}
          {activeTab === 'models' && (
            <ModelsTab dataId={uploadData.id} trainResult={trainResult} setTrainResult={setTrainResult} />
          )}
          {activeTab === 'shap' && (
            <SHAPTab dataId={uploadData.id} trainResult={trainResult} columns={uploadData.columns} />
          )}
          {activeTab === 'whatif' && (
            <WhatIfTab dataId={uploadData.id} trainResult={trainResult} columns={uploadData.columns} uploadData={uploadData} />
          )}
          {activeTab === 'dashboard' && (
            <DashboardTab dataId={uploadData.id} uploadData={uploadData} />
          )}
          {activeTab === 'risk' && (
            <RiskScoringTab dataId={uploadData.id} trainResult={trainResult} />
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
