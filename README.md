# KALA Group — Employee Attrition Intelligence System

A full-stack AI-powered HR analytics platform for predicting, explaining, and reducing employee attrition.

## Project Structure

```
attrition-app/
├── backend/
│   ├── app.py              # Flask REST API (all 8 endpoints)
│   ├── requirements.txt
│   └── venv/               # Python virtual environment
└── frontend/
    ├── src/
│   │   ├── components/     # 10 React components
│   │   ├── utils/api.js    # API client + helpers
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css       # Dark design system
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── vercel.json
```

## Setup & Running

### Backend (Flask)
```powershell
cd backend
.\venv\Scripts\activate   # or: python -m venv venv then activate
pip install -r requirements.txt
python app.py
# Server starts at http://localhost:5000
```

### Frontend (React)
```powershell
cd frontend
npm install               # Already done
npm run dev
# App starts at http://localhost:5173
```

> **Vite Proxy**: All `/api/*` requests are proxied to `http://localhost:5000` automatically.

## Features

| Tab | Description |
|-----|-------------|
| 🏠 Overview | KPI cards, donut chart, dataset column browser |
| 📊 EDA | Correlation heatmap, attrition by dept/grade/overtime, income boxplot, satisfaction heatmap |
| 🤖 Models | Train RF + XGBoost + LR with SMOTE, compare metrics, ROC curves, confusion matrix |
| 🔍 SHAP | Global feature importance + 5 AI insights; individual waterfall by employee index |
| 🎯 What-If | 12 sliders + 6 dropdowns → gauge chart, risk/retention cards, recommendations |
| 📈 Dashboards | Dept filter + 6 KPIs + 7 Recharts (dept, role, income, satisfaction, overtime, tenure, age) |
| ⚠️ Risk Scoring | Sortable table, pie chart, dept stacked bar, CSV download |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload XLSX/CSV, returns dataset ID |
| GET | `/api/eda/<id>` | EDA charts data |
| POST | `/api/train/<id>` | Train all models, returns metrics |
| GET | `/api/shap/global/<id>` | SHAP feature importance + insights |
| GET | `/api/shap/individual/<id>/<idx>` | Individual waterfall + risk level |
| POST | `/api/predict/<id>` | What-If prediction |
| GET | `/api/risk/<id>` | Full dataset risk scoring |
| GET | `/api/dashboard/<id>?depts=X` | Dashboard KPIs + chart data |

## Tech Stack

- **Backend**: Python, Flask, scikit-learn, XGBoost, SHAP, imbalanced-learn (SMOTE), pandas
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, react-dropzone, axios
- **AI**: Random Forest + XGBoost + Logistic Regression with RandomizedSearchCV
- **Explainability**: SHAP TreeExplainer / LinearExplainer
