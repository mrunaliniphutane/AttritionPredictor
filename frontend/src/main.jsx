import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1B2A4A',
          color: '#E2E8F0',
          border: '1px solid #2A3F6A',
          borderRadius: '12px',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: '#34D399', secondary: '#0F1A2E' } },
        error: { iconTheme: { primary: '#FB7185', secondary: '#0F1A2E' } },
      }}
    />
  </React.StrictMode>
)
