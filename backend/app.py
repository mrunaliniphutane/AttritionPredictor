import os
import io
import uuid
import json
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix, roc_curve
)
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE
import shap

app = Flask(__name__)
CORS(app)

# ─── In-memory store ────────────────────────────────────────────────────────
STORE = {}   # id -> { df_raw, df_encoded, encoders, model_cache, feature_cols, X_test, y_test, best_model, explainer, shap_vals }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def convert(obj):
    """Recursively convert numpy/pandas types to Python native for JSON."""
    if isinstance(obj, dict):
        return {k: convert(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert(i) for i in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, pd.Series):
        return obj.tolist()
    # Handle pandas Categorical scalar
    if hasattr(obj, 'categories'):
        return str(obj)
    # Safe NaN check — avoid calling pd.isna on unhashable/complex types
    try:
        if not isinstance(obj, (list, dict, np.ndarray, bool)) and pd.isna(obj):
            return None
    except (TypeError, ValueError):
        pass
    return obj


def safe_json(data):
    return jsonify(convert(data))


DROP_CONSTANT = ["Over18", "StandardHours", "EmployeeCount"]
DROP_NON_PREDICTIVE = ["EmployeeName", "EmployeeNumber", "DateOfJoining"]
TARGET = "Attrition"


def preprocess(df_raw):
    df = df_raw.copy()
    # Drop constant/non-predictive
    to_drop = [c for c in DROP_CONSTANT + DROP_NON_PREDICTIVE if c in df.columns]
    df.drop(columns=to_drop, inplace=True, errors="ignore")

    # Encode target
    if TARGET in df.columns:
        df[TARGET] = df[TARGET].map({"Yes": 1, "No": 0, 1: 1, 0: 0}).fillna(0).astype(int)

    # Label encode categoricals
    encoders = {}
    for col in df.select_dtypes(include=["object", "category"]).columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le

    return df, encoders


# ─── Upload ──────────────────────────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    f = request.files["file"]
    fname = f.filename.lower()
    try:
        if fname.endswith(".xlsx") or fname.endswith(".xls"):
            df = pd.read_excel(f, engine="openpyxl")
        elif fname.endswith(".csv"):
            df = pd.read_csv(f)
        else:
            return jsonify({"error": "Unsupported file format. Use XLSX or CSV."}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to read file: {str(e)}"}), 400

    uid = str(uuid.uuid4())
    STORE[uid] = {
        "df_raw": df,
        "df_encoded": None,
        "encoders": {},
        "model_cache": {},
        "feature_cols": [],
        "X_test": None,
        "y_test": None,
        "best_model": None,
        "best_model_name": None,
        "explainer": None,
        "shap_vals": None,
    }

    attrition_split = {}
    if TARGET in df.columns:
        vc = df[TARGET].value_counts()
        attrition_split = {str(k): int(v) for k, v in vc.items()}

    dept_counts = {}
    for col in ["Department", "SubDepartment", "Dept"]:
        if col in df.columns:
            dept_counts = df[col].value_counts().to_dict()
            dept_counts = {str(k): int(v) for k, v in dept_counts.items()}
            break

    # Store the raw column info for metadata
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = [c for c in cat_cols if c != TARGET]
    num_cols = [c for c in num_cols if c != TARGET]

    STORE[uid]["raw_cat_cols"] = cat_cols
    STORE[uid]["raw_num_cols"] = num_cols

    return safe_json({
        "id": uid,
        "rows": len(df),
        "cols": len(df.columns),
        "columns": list(df.columns),
        "attrition_split": attrition_split,
        "dept_counts": dept_counts,
    })


# ─── Metadata (for dynamic What-If form) ────────────────────────────────────

@app.route("/api/metadata/<uid>", methods=["GET"])
def metadata(uid):
    if uid not in STORE:
        return jsonify({"error": "Dataset not found"}), 404
    df = STORE[uid]["df_raw"]
    feature_cols = STORE[uid].get("feature_cols", [])
    encoders = STORE[uid].get("encoders", {})
    df_encoded = STORE[uid].get("df_encoded")

    fields = []
    for col in feature_cols:
        if col in encoders:
            # Categorical column — get original labels
            le = encoders[col]
            labels = list(le.classes_)
            fields.append({
                "name": col,
                "type": "categorical",
                "options": [str(l) for l in labels],
                "default": str(labels[0]) if labels else "",
            })
        else:
            # Numeric column — get stats from encoded data
            if df_encoded is not None and col in df_encoded.columns:
                col_data = df_encoded[col].dropna()
                fields.append({
                    "name": col,
                    "type": "numeric",
                    "min": float(col_data.min()),
                    "max": float(col_data.max()),
                    "median": float(col_data.median()),
                    "mean": round(float(col_data.mean()), 2),
                    "step": 1 if col_data.dtype in [np.int64, np.int32] else 0.1,
                })
            else:
                fields.append({
                    "name": col,
                    "type": "numeric",
                    "min": 0, "max": 100, "median": 50, "mean": 50, "step": 1,
                })
    return safe_json({"fields": fields})


# ─── EDA ─────────────────────────────────────────────────────────────────────

@app.route("/api/eda/<uid>", methods=["GET"])
def eda(uid):
    if uid not in STORE:
        return jsonify({"error": "Dataset not found"}), 404
    df = STORE[uid]["df_raw"].copy()

    result = {}

    # Correlation matrix (numeric only, top 20 cols)
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if TARGET in num_cols:
        # keep target
        pass
    if len(num_cols) > 20:
        # pick cols most correlated with Attrition if available
        if TARGET in df.columns:
            tgt_corr = df[num_cols].corrwith(df[TARGET].map({"Yes": 1, "No": 0}).fillna(df[TARGET])).abs()
            num_cols = tgt_corr.nlargest(20).index.tolist()
        else:
            num_cols = num_cols[:20]

    corr = df[num_cols].corr().round(3)
    result["correlation"] = {
        "labels": list(corr.columns),
        "matrix": corr.values.tolist()
    }

    # Attrition by Department
    dept_col = next((c for c in ["Department", "SubDepartment", "Dept"] if c in df.columns), None)
    if dept_col and TARGET in df.columns:
        grp = df.groupby(dept_col)[TARGET].apply(
            lambda x: (x.map({"Yes": 1, "No": 0}).fillna(x).sum() / len(x) * 100) if x.dtype == object else (x.sum() / len(x) * 100)
        ).round(2)
        result["attrition_by_dept"] = {"labels": list(grp.index), "values": list(grp.values)}
    else:
        result["attrition_by_dept"] = {"labels": [], "values": []}

    # Attrition by Grade
    grade_col = next((c for c in ["Grade", "JobLevel", "Level"] if c in df.columns), None)
    if grade_col and TARGET in df.columns:
        grp = df.groupby(grade_col)[TARGET].apply(
            lambda x: (x.map({"Yes": 1, "No": 0}).fillna(x).sum() / len(x) * 100) if x.dtype == object else (x.sum() / len(x) * 100)
        ).round(2)
        result["attrition_by_grade"] = {"labels": [str(l) for l in grp.index], "values": list(grp.values)}
    else:
        result["attrition_by_grade"] = {"labels": [], "values": []}

    # Attrition by OverTime
    ot_col = next((c for c in ["OverTime", "Overtime"] if c in df.columns), None)
    if ot_col and TARGET in df.columns:
        grp = df.groupby(ot_col)[TARGET].apply(
            lambda x: (x.map({"Yes": 1, "No": 0}).fillna(x).sum() / len(x) * 100) if x.dtype == object else (x.sum() / len(x) * 100)
        ).round(2)
        result["attrition_by_overtime"] = {"labels": [str(l) for l in grp.index], "values": list(grp.values)}
    else:
        result["attrition_by_overtime"] = {"labels": [], "values": []}

    # Income by Attrition
    income_col = next((c for c in ["MonthlyIncome", "Monthly Income", "Salary"] if c in df.columns), None)
    if income_col and TARGET in df.columns:
        grps = {}
        for val, grp_df in df.groupby(TARGET):
            key = str(val)
            vals = grp_df[income_col].dropna().tolist()
            grps[key] = vals[:200]
        result["income_by_attrition"] = grps
    else:
        result["income_by_attrition"] = {}

    # Satisfaction heatmap
    sat_cols = [c for c in df.columns if "satisfaction" in c.lower() or "Satisfaction" in c]
    if sat_cols and dept_col:
        hmap = df.groupby(dept_col)[sat_cols].mean().round(2)
        result["satisfaction_heatmap"] = {
            "depts": list(hmap.index),
            "features": sat_cols,
            "values": hmap.values.tolist()
        }
    else:
        result["satisfaction_heatmap"] = {"depts": [], "features": [], "values": []}

    return safe_json(result)


# ─── Train ───────────────────────────────────────────────────────────────────

@app.route("/api/train/<uid>", methods=["POST"])
def train(uid):
    if uid not in STORE:
        return jsonify({"error": "Dataset not found"}), 404

    df, encoders = preprocess(STORE[uid]["df_raw"])
    STORE[uid]["df_encoded"] = df
    STORE[uid]["encoders"] = encoders

    if TARGET not in df.columns:
        return jsonify({"error": f"Target column '{TARGET}' not found"}), 400

    X = df.drop(columns=[TARGET])
    y = df[TARGET]
    STORE[uid]["feature_cols"] = list(X.columns)

    # Split: 60% train, 20% calibration, 20% test
    X_train_full, X_test, y_train_full, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    X_train, X_cal, y_train, y_cal = train_test_split(
        X_train_full, y_train_full, test_size=0.25, random_state=42, stratify=y_train_full
    )

    # SMOTE on train only
    try:
        sm = SMOTE(random_state=42, k_neighbors=min(5, int(y_train.sum()) - 1))
        X_train_sm, y_train_sm = sm.fit_resample(X_train, y_train)
    except Exception:
        X_train_sm, y_train_sm = X_train, y_train

    STORE[uid]["X_test"] = X_test
    STORE[uid]["y_test"] = y_test

    results = {}
    raw_models = {}
    calibrated_models = {}

    # ── Random Forest ──
    rf_params = {
        "n_estimators": [100, 200, 300],
        "max_depth": [None, 5, 10, 15],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
    }
    rf = RandomForestClassifier(random_state=42, n_jobs=-1)
    rf_cv = RandomizedSearchCV(rf, rf_params, n_iter=10, cv=3, scoring="f1", random_state=42, n_jobs=-1)
    rf_cv.fit(X_train_sm, y_train_sm)
    raw_models["Random Forest"] = rf_cv.best_estimator_

    # ── XGBoost ──
    xgb_params = {
        "n_estimators": [100, 200, 300],
        "max_depth": [3, 5, 7],
        "learning_rate": [0.01, 0.05, 0.1, 0.2],
        "subsample": [0.6, 0.8, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
    }
    scale_pos = float(y_train.value_counts()[0] / max(y_train.value_counts()[1], 1))
    xgb = XGBClassifier(random_state=42, eval_metric="logloss", scale_pos_weight=scale_pos)
    xgb_cv = RandomizedSearchCV(xgb, xgb_params, n_iter=10, cv=3, scoring="f1", random_state=42, n_jobs=-1)
    xgb_cv.fit(X_train_sm, y_train_sm)
    raw_models["XGBoost"] = xgb_cv.best_estimator_

    # ── Logistic Regression ──
    lr_params = {"C": [0.001, 0.01, 0.1, 1, 10, 100], "penalty": ["l2"], "solver": ["lbfgs"]}
    lr = LogisticRegression(random_state=42, max_iter=1000)
    lr_cv = RandomizedSearchCV(lr, lr_params, n_iter=6, cv=3, scoring="f1", random_state=42)
    lr_cv.fit(X_train_sm, y_train_sm)
    raw_models["Logistic Regression"] = lr_cv.best_estimator_

    # ── Calibrate all models on the calibration set ──
    for name, mdl in raw_models.items():
        try:
            cal = CalibratedClassifierCV(mdl, method="sigmoid", cv="prefit")
            cal.fit(X_cal, y_cal)
            calibrated_models[name] = cal
        except Exception:
            calibrated_models[name] = mdl  # fallback to raw if calibration fails

    # ── Evaluate using CALIBRATED models ──
    best_name = None
    best_auc = -1
    for name, mdl in calibrated_models.items():
        y_pred = mdl.predict(X_test)
        y_prob = mdl.predict_proba(X_test)[:, 1]
        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, zero_division=0))
        rec = float(recall_score(y_test, y_pred, zero_division=0))
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        auc = float(roc_auc_score(y_test, y_prob))
        cm = confusion_matrix(y_test, y_pred).tolist()
        fpr, tpr, _ = roc_curve(y_test, y_prob)
        results[name] = {
            "Accuracy": round(acc, 4),
            "Precision": round(prec, 4),
            "Recall": round(rec, 4),
            "F1": round(f1, 4),
            "AUC_ROC": round(auc, 4),
            "confusion_matrix": cm,
            "roc": {"fpr": fpr.tolist(), "tpr": tpr.tolist()},
        }
        if auc > best_auc:
            best_auc = auc
            best_name = name

    STORE[uid]["model_cache"] = calibrated_models
    STORE[uid]["best_model"] = calibrated_models[best_name]
    STORE[uid]["best_model_name"] = best_name

    # Build SHAP explainer for best RAW model (SHAP needs the raw estimator)
    try:
        raw_best = raw_models[best_name]
        if best_name == "Logistic Regression":
            explainer = shap.LinearExplainer(raw_best, X_train_sm, feature_names=list(X.columns))
        else:
            explainer = shap.TreeExplainer(raw_best)
        shap_vals = explainer.shap_values(X_test)
        # For binary classifiers shap_vals may be list [neg, pos]
        if isinstance(shap_vals, list) and len(shap_vals) == 2:
            shap_vals = shap_vals[1]
        STORE[uid]["explainer"] = explainer
        STORE[uid]["shap_vals"] = shap_vals
        STORE[uid]["X_test_df"] = X_test.reset_index(drop=True)
    except Exception as e:
        STORE[uid]["explainer"] = None
        STORE[uid]["shap_vals"] = None
        STORE[uid]["X_test_df"] = X_test.reset_index(drop=True)

    return safe_json({
        "best_model": best_name,
        "metrics": results,
    })


# ─── SHAP Global ─────────────────────────────────────────────────────────────

@app.route("/api/shap/global/<uid>", methods=["GET"])
def shap_global(uid):
    if uid not in STORE:
        return jsonify({"error": "Dataset not found"}), 404
    shap_vals = STORE[uid].get("shap_vals")
    feature_cols = STORE[uid].get("feature_cols", [])
    if shap_vals is None:
        return jsonify({"error": "Model not trained yet"}), 400

    mean_shap = np.abs(shap_vals).mean(axis=0)
    indices = np.argsort(mean_shap)[::-1][:15]
    top_features = [feature_cols[i] for i in indices]
    top_vals = [float(mean_shap[i]) for i in indices]

    # Auto-generate business insights
    insights = []
    if len(top_features) > 0:
        insights.append(f"🔑 **{top_features[0]}** is the strongest predictor of attrition — focus retention efforts here first.")
    if len(top_features) > 1:
        insights.append(f"📊 **{top_features[1]}** and **{top_features[0]}** together account for the largest share of attrition risk signals.")
    if any("income" in f.lower() or "salary" in f.lower() for f in top_features[:5]):
        insights.append("💰 Compensation-related features rank highly — consider salary benchmarking to reduce voluntary turnover.")
    else:
        insights.append("🕐 Work-life balance and job satisfaction factors appear more influential than compensation in this dataset.")
    if any("overtime" in f.lower() for f in top_features[:7]):
        insights.append("⏰ Employees working overtime show significantly elevated attrition risk — monitor workload distribution.")
    else:
        insights.append("🏢 Department and role-specific factors drive attrition — targeted department interventions may be most effective.")
    insights.append(f"📈 The top 5 features ({', '.join(top_features[:5])}) explain the majority of model predictions — prioritise data collection and HR programmes around these areas.")

    return safe_json({
        "features": top_features,
        "values": top_vals,
        "insights": insights,
    })


# ─── SHAP Individual ─────────────────────────────────────────────────────────

@app.route("/api/shap/individual/<uid>/<int:idx>", methods=["GET"])
def shap_individual(uid, idx):
    if uid not in STORE:
        return jsonify({"error": "Dataset not found"}), 404
    shap_vals = STORE[uid].get("shap_vals")
    X_test_df = STORE[uid].get("X_test_df")
    feature_cols = STORE[uid].get("feature_cols", [])
    y_test = STORE[uid].get("y_test")

    if shap_vals is None or X_test_df is None:
        return jsonify({"error": "Model not trained yet"}), 400
    if idx >= len(X_test_df):
        return jsonify({"error": "Index out of range"}), 400

    row_shap = shap_vals[idx]
    sorted_idx = np.argsort(np.abs(row_shap))[::-1][:15]
    waterfall_features = [feature_cols[i] for i in sorted_idx]
    waterfall_values = [float(row_shap[i]) for i in sorted_idx]
    feature_vals = {feature_cols[i]: float(X_test_df.iloc[idx][feature_cols[i]]) for i in sorted_idx}

    top3_pos = [(feature_cols[i], row_shap[i]) for i in sorted_idx if row_shap[i] > 0][:3]
    top3_neg = [(feature_cols[i], row_shap[i]) for i in sorted_idx if row_shap[i] < 0][:3]

    risk_factors = [f[0] for f in top3_pos]
    retention_factors = [f[0] for f in top3_neg]

    best_mdl = STORE[uid].get("best_model")
    prob = 0.5
    if best_mdl is not None:
        prob = float(best_mdl.predict_proba(X_test_df.iloc[[idx]])[0, 1])

    risk_level = "LOW" if prob < 0.3 else ("MEDIUM" if prob < 0.6 else "HIGH")
    explanation = f"{risk_level} risk because: " + (
        ", ".join(risk_factors) if risk_factors else "balanced factors"
    )

    actual = int(y_test.iloc[idx]) if y_test is not None else None

    return safe_json({
        "employee_index": idx,
        "attrition_probability": round(prob, 4),
        "risk_level": risk_level,
        "explanation": explanation,
        "waterfall": {
            "features": waterfall_features,
            "shap_values": waterfall_values,
            "feature_values": feature_vals,
        },
        "risk_factors": risk_factors,
        "retention_factors": retention_factors,
        "actual": actual,
        "employee_details": X_test_df.iloc[idx].to_dict(),
    })


# ─── Predict (What-If) ───────────────────────────────────────────────────────

@app.route("/api/predict/<uid>", methods=["POST"])
def predict(uid):
    if uid not in STORE:
        return jsonify({"error": "Dataset not found"}), 404
    best_mdl = STORE[uid].get("best_model")
    if best_mdl is None:
        return jsonify({"error": "Model not trained yet"}), 400

    data = request.json
    feature_cols = STORE[uid]["feature_cols"]
    encoders = STORE[uid]["encoders"]
    df_encoded = STORE[uid]["df_encoded"]

    # Build row
    row = {}
    for col in feature_cols:
        val = data.get(col, None)
        if val is None:
            if df_encoded is not None and col in df_encoded.columns:
                val = df_encoded[col].median()
            else:
                val = 0
        else:
            # If column has an encoder (was categorical), encode
            if col in encoders:
                le = encoders[col]
                try:
                    val = int(le.transform([str(val)])[0])
                except Exception:
                    # Unseen category: use the mode (most frequent) from training data
                    if df_encoded is not None and col in df_encoded.columns:
                        val = int(df_encoded[col].mode().iloc[0])
                    else:
                        val = 0
            else:
                try:
                    val = float(val)
                except Exception:
                    val = 0
        row[col] = val

    X_row = pd.DataFrame([row])
    prob = float(best_mdl.predict_proba(X_row)[0, 1])

    if prob < 0.25:
        risk_cat = "Low"
    elif prob < 0.50:
        risk_cat = "Medium"
    elif prob < 0.75:
        risk_cat = "High"
    else:
        risk_cat = "Critical"

    # SHAP contributions
    shap_contribs = []
    explainer = STORE[uid].get("explainer")
    if explainer is not None:
        try:
            sv = explainer.shap_values(X_row)
            if isinstance(sv, list) and len(sv) == 2:
                sv = sv[1]
            sv = sv[0]
            idx_sorted = np.argsort(np.abs(sv))[::-1][:15]
            shap_contribs = [{"feature": feature_cols[i], "value": float(sv[i])} for i in idx_sorted]
        except Exception:
            shap_contribs = []

    risk_factors = [s["feature"] for s in shap_contribs if s["value"] > 0][:3]
    retention_factors = [s["feature"] for s in shap_contribs if s["value"] < 0][:3]

    recommendations = []
    for rf in risk_factors:
        rl = rf.lower()
        if "overtime" in rl:
            recommendations.append("Reduce mandatory overtime and implement flexible work arrangements.")
        elif "income" in rl or "salary" in rl:
            recommendations.append("Conduct salary benchmarking and consider compensation adjustments.")
        elif "distance" in rl:
            recommendations.append("Offer remote work options or transport allowances to reduce commute burden.")
        elif "satisfaction" in rl:
            recommendations.append(f"Improve job satisfaction through regular 1:1s and recognition programmes (factor: {rf}).")
        elif "promotion" in rl:
            recommendations.append("Create clear promotion pathways and review this employee for advancement opportunities.")
        elif "age" in rl or "tenure" in rl or "years" in rl:
            recommendations.append("Develop a retention plan for mid-career employees — career development and mentoring.")
        elif "travel" in rl:
            recommendations.append("Limit business travel or provide additional compensation for frequent travel.")
        else:
            recommendations.append(f"Review and improve conditions related to **{rf}** through targeted HR intervention.")

    if not recommendations:
        recommendations.append("Employee appears stable — continue standard engagement practices.")

    return safe_json({
        "probability": round(prob, 4),
        "risk_category": risk_cat,
        "shap_contributions": shap_contribs,
        "risk_factors": risk_factors,
        "retention_factors": retention_factors,
        "recommendations": recommendations,
    })


# ─── Risk Scoring ─────────────────────────────────────────────────────────────

@app.route("/api/risk/<uid>", methods=["GET"])
def risk_scoring(uid):
    if uid not in STORE:
        return jsonify({"error": "Dataset not found"}), 404
    best_mdl = STORE[uid].get("best_model")
    df_encoded = STORE[uid].get("df_encoded")
    df_raw = STORE[uid].get("df_raw")
    feature_cols = STORE[uid].get("feature_cols", [])

    if best_mdl is None or df_encoded is None:
        return jsonify({"error": "Model not trained yet"}), 400

    X_full = df_encoded[feature_cols]
    probs = best_mdl.predict_proba(X_full)[:, 1]

    df_out = df_raw.copy().reset_index(drop=True)
    df_out["risk_score"] = (probs * 100).round(1)
    # Use numpy select instead of pd.cut to avoid Categorical serialization issues
    risk_score = df_out["risk_score"]
    conditions = [
        risk_score <= 25,
        risk_score <= 50,
        risk_score <= 75,
    ]
    df_out["risk_category"] = np.select(conditions, ["Low", "Medium", "High"], default="Critical")

    # Department distribution
    dept_col = next((c for c in ["Department", "SubDepartment", "Dept"] if c in df_out.columns), None)
    dept_dist = {}
    if dept_col:
        try:
            grp = df_out.groupby([dept_col, "risk_category"]).size().unstack(fill_value=0)
            dept_dist = {
                "depts": [str(d) for d in grp.index],
                "categories": [str(c) for c in grp.columns],
                "counts": grp.values.tolist()
            }
        except Exception:
            dept_dist = {}

    # Summary table — take top 100 highest risk
    df_sorted = df_out.sort_values("risk_score", ascending=False).head(100)
    keep_cols = ["risk_score", "risk_category"]
    id_col = next((c for c in ["EmployeeName", "EmployeeNumber", "EmpID", "EmpId"] if c in df_sorted.columns), None)
    if id_col:
        keep_cols = [id_col] + keep_cols
    if dept_col:
        keep_cols.append(dept_col)
    for extra in ["JobRole", "Department", "Grade", "JobLevel"]:
        if extra in df_sorted.columns and extra not in keep_cols:
            keep_cols.append(extra)
    keep_cols = [c for c in keep_cols if c in df_sorted.columns]

    # Convert all columns to safe types before dict conversion
    df_export = df_sorted[keep_cols].copy()
    for col in df_export.columns:
        if df_export[col].dtype.name == 'category':
            df_export[col] = df_export[col].astype(str)
    records = []
    for rec in df_export.to_dict(orient="records"):
        clean = {}
        for k, v in rec.items():
            try:
                if pd.isna(v):
                    clean[k] = None
                    continue
            except (TypeError, ValueError):
                pass
            if isinstance(v, (np.integer,)):
                clean[k] = int(v)
            elif isinstance(v, (np.floating,)):
                clean[k] = float(v)
            else:
                clean[k] = v
        records.append(clean)

    # Category counts
    cat_counts = df_out["risk_category"].value_counts().to_dict()

    return safe_json({
        "total": len(df_out),
        "category_counts": {str(k): int(v) for k, v in cat_counts.items()},
        "dept_distribution": dept_dist,
        "employees": records,
        "avg_risk": round(float(df_out["risk_score"].mean()), 2),
        "high_risk_count": int((df_out["risk_score"] >= 50).sum()),
    })


# ─── Dashboard ───────────────────────────────────────────────────────────────

@app.route("/api/dashboard/<uid>", methods=["GET"])
def dashboard(uid):
    if uid not in STORE:
        return jsonify({"error": "Dataset not found"}), 404
    df = STORE[uid]["df_raw"].copy()

    # Filter by dept if requested
    depts_param = request.args.get("depts", "")
    dept_col = next((c for c in ["Department", "SubDepartment", "Dept"] if c in df.columns), None)
    if depts_param and dept_col:
        selected = [d.strip() for d in depts_param.split(",") if d.strip()]
        if selected:
            df = df[df[dept_col].isin(selected)]

    result = {}

    # KPIs
    total = len(df)
    result["kpi"] = {"total_employees": total}

    if TARGET in df.columns:
        attrition_num = df[TARGET].map({"Yes": 1, "No": 0}).fillna(df[TARGET]).astype(float)
        result["kpi"]["attrition_rate"] = round(float(attrition_num.mean() * 100), 2)
        result["kpi"]["attritioned"] = int(attrition_num.sum())
        result["kpi"]["retained"] = int(total - attrition_num.sum())

    income_col = next((c for c in ["MonthlyIncome", "Monthly Income", "Salary"] if c in df.columns), None)
    if income_col:
        result["kpi"]["avg_income"] = round(float(df[income_col].mean()), 2)
        result["kpi"]["median_income"] = round(float(df[income_col].median()), 2)

    age_col = next((c for c in ["Age", "age"] if c in df.columns), None)
    if age_col:
        result["kpi"]["avg_age"] = round(float(df[age_col].mean()), 2)

    # Chart 1: Attrition by dept
    if dept_col and TARGET in df.columns:
        grp = df.groupby(dept_col).agg(
            total=(TARGET, "count"),
            attrited=(TARGET, lambda x: x.map({"Yes": 1, "No": 0}).fillna(x).sum())
        ).reset_index()
        result["dept_attrition"] = grp.rename(columns={dept_col: "dept"}).to_dict(orient="records")
    else:
        result["dept_attrition"] = []

    # Chart 2: Attrition by role
    role_col = next((c for c in ["JobRole", "Job Role", "Role"] if c in df.columns), None)
    if role_col and TARGET in df.columns:
        grp = df.groupby(role_col).agg(
            total=(TARGET, "count"),
            attrited=(TARGET, lambda x: x.map({"Yes": 1, "No": 0}).fillna(x).sum())
        ).reset_index()
        result["role_attrition"] = grp.rename(columns={role_col: "role"}).to_dict(orient="records")
    else:
        result["role_attrition"] = []

    # Chart 3: Income distribution
    if income_col and dept_col:
        grp = df.groupby(dept_col)[income_col].agg(["mean", "median", "min", "max"]).reset_index()
        result["income_dist"] = grp.rename(columns={dept_col: "dept"}).to_dict(orient="records")
    else:
        result["income_dist"] = []

    # Chart 4: Satisfaction heatmap
    sat_cols = [c for c in df.columns if "satisfaction" in c.lower() or "Satisfaction" in c]
    if sat_cols and dept_col:
        hmap = df.groupby(dept_col)[sat_cols].mean().round(2).reset_index()
        result["satisfaction"] = hmap.rename(columns={dept_col: "dept"}).to_dict(orient="records")
        result["satisfaction_cols"] = sat_cols
    else:
        result["satisfaction"] = []
        result["satisfaction_cols"] = []

    # Chart 5: Overtime stacked
    ot_col = next((c for c in ["OverTime", "Overtime"] if c in df.columns), None)
    if ot_col and dept_col:
        grp = df.groupby([dept_col, ot_col]).size().unstack(fill_value=0).reset_index()
        result["overtime_stacked"] = grp.rename(columns={dept_col: "dept"}).to_dict(orient="records")
    else:
        result["overtime_stacked"] = []

    # Chart 6: Tenure
    tenure_col = next((c for c in ["YearsAtCompany", "Tenure", "YearsInCurrentRole"] if c in df.columns), None)
    if tenure_col:
        bins = [0, 2, 5, 10, 15, 20, 100]
        labels = ["0-2", "2-5", "5-10", "10-15", "15-20", "20+"]
        # Convert categorical to string to avoid serialization issues
        df["tenure_group"] = pd.cut(df[tenure_col], bins=bins, labels=labels, right=False).astype(str)
        if TARGET in df.columns:
            grp = df.groupby("tenure_group")[TARGET].apply(
                lambda x: x.map({"Yes": 1, "No": 0}).fillna(x).sum() / len(x) * 100
            ).round(2).reset_index()
            grp.columns = ["tenure_group", "attrition_rate"]
        else:
            grp = df["tenure_group"].value_counts().reset_index()
            grp.columns = ["tenure_group", "count"]
        result["tenure_chart"] = [{"tenure_group": str(r["tenure_group"]), **{k: float(v) if isinstance(v, (int, float, np.floating, np.integer)) else v for k, v in r.items() if k != "tenure_group"}} for r in grp.to_dict(orient="records")]
    else:
        result["tenure_chart"] = []

    # Chart 7: Age histogram
    if age_col:
        bins = list(range(18, 65, 5))
        df["age_bin"] = pd.cut(df[age_col], bins=bins)
        grp = df["age_bin"].value_counts().sort_index().reset_index()
        grp.columns = ["age_range", "count"]
        grp["age_range"] = grp["age_range"].astype(str)
        result["age_histogram"] = grp.to_dict(orient="records")
    else:
        result["age_histogram"] = []

    # Available depts for filter
    if dept_col:
        result["all_depts"] = sorted(STORE[uid]["df_raw"][dept_col].dropna().unique().tolist())
    else:
        result["all_depts"] = []

    return safe_json(result)


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, port=port)
