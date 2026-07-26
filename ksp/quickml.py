"""ML payload builders using Catalyst QuickML + statistical fallback."""
from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List

import zcatalyst_sdk

from .data import district_by_id, get_cases, parse_date
from .analytics import _crime_label, _district_of


# ── Catalyst QuickML helper ───────────────────────────────────────────────────

def _quickml_predict(model_name: str, features: List[Dict]) -> Dict | None:
    try:
        app = zcatalyst_sdk.initialize()
        qml = app.quick_ml()
        result = qml.predict(model_name, features)
        return result
    except Exception:
        return None


# ── Risk scoring ──────────────────────────────────────────────────────────────

def build_quickml_risk_payload(request, body: Dict) -> Dict:
    district_id = body.get("district_id")
    days = body.get("days", 90)
    cases = get_cases(days, district_id)
    dbi = district_by_id()

    dist_c: Counter = Counter()
    crime_c: Counter = Counter()
    for c in cases:
        dist_c[dbi.get(_district_of(c), "Unknown")] += 1
        crime_c[_crime_label(c)] += 1

    max_d = max(dist_c.values(), default=1)
    max_c = max(crime_c.values(), default=1)

    risk_areas = [
        {"district": d, "caseCount": cnt,
         "riskScore": round(cnt / max_d * 100, 1),
         "riskLevel": "High" if cnt/max_d > 0.7 else "Medium" if cnt/max_d > 0.3 else "Low"}
        for d, cnt in dist_c.most_common(10)
    ]
    emerging_crimes = [
        {"crime": cr, "count": cnt, "riskScore": round(cnt / max_c * 100, 1)}
        for cr, cnt in crime_c.most_common(5)
    ]

    ml = _quickml_predict("ksp_risk_model", risk_areas)
    return {
        "riskAreas": risk_areas,
        "emergingCrimes": emerging_crimes,
        "mlPrediction": ml,
        "source": "quickml" if ml else "statistical",
    }


# ── Anomaly detection ─────────────────────────────────────────────────────────

def build_quickml_anomaly_payload(request, body: Dict) -> Dict:
    district_id = body.get("district_id")
    days = body.get("days", 180)

    recent = get_cases(30, district_id)
    baseline = get_cases(days, district_id)

    recent_c: Counter = Counter(_crime_label(c) for c in recent)
    baseline_c: Counter = Counter(_crime_label(c) for c in baseline)

    anomalies = []
    for crime, rc in recent_c.most_common():
        bc = baseline_c.get(crime, 1)
        expected = bc * (30 / days)
        if expected > 0:
            score = rc / expected
            if score > 1.4:
                anomalies.append({
                    "crime": crime, "recentCount": rc,
                    "expectedCount": round(expected, 1),
                    "anomalyScore": round(score, 2),
                    "severity": "Critical" if score > 3 else "High" if score > 2 else "Medium",
                })
    anomalies.sort(key=lambda x: x["anomalyScore"], reverse=True)

    ml = _quickml_predict("ksp_anomaly_model", anomalies)
    return {
        "anomalies": anomalies[:15],
        "mlEnhanced": ml,
        "source": "quickml" if ml else "statistical",
    }


# ── Natural Language Query ────────────────────────────────────────────────────

def build_nlq_payload(request, body: Dict) -> Dict:
    question = body.get("question", "")
    q = question.lower()

    # Try Catalyst QuickML LLM
    try:
        app = zcatalyst_sdk.initialize()
        qml = app.quick_ml()
        result = qml.predict("ksp_nlq_model", [{"question": question}])
        if result:
            return {"question": question, "answer": result, "source": "quickml"}
    except Exception:
        pass

    # Statistical fallback
    cases = get_cases(365)
    dbi = district_by_id()
    crime_c: Counter = Counter(_crime_label(c) for c in cases)
    dist_c: Counter = Counter(dbi.get(_district_of(c), "Unknown") for c in cases)

    answer: Dict[str, Any] = {"question": question, "source": "statistical"}

    if any(k in q for k in ["hotspot", "most crime", "highest", "top district"]):
        top = dist_c.most_common(5)
        answer["result"] = [{"district": d, "cases": cnt} for d, cnt in top]
        answer["summary"] = f"Top crime district: {top[0][0]} with {top[0][1]} cases." if top else "No data."
    elif any(k in q for k in ["trend", "rising", "spike", "increasing"]):
        recent = get_cases(30)
        top = Counter(_crime_label(c) for c in recent).most_common(5)
        answer["result"] = [{"crime": cr, "recentCases": cnt} for cr, cnt in top]
        answer["summary"] = f"Most active crime recently: {top[0][0]}." if top else "No data."
    elif any(k in q for k in ["theft", "robbery", "burglary"]):
        cnt = sum(v for k, v in crime_c.items() if any(w in k.lower() for w in ["theft", "robbery", "burglary"]))
        answer["result"] = {"crimeType": "Property Crimes", "totalCases": cnt}
        answer["summary"] = f"Total property crime cases: {cnt}."
    elif any(k in q for k in ["murder", "kill", "homicide"]):
        cnt = sum(v for k, v in crime_c.items() if any(w in k.lower() for w in ["murder", "kill"]))
        answer["result"] = {"crimeType": "Violent Crimes", "totalCases": cnt}
        answer["summary"] = f"Total violent crime cases: {cnt}."
    else:
        top = crime_c.most_common(5)
        answer["result"] = [{"crime": cr, "count": cnt} for cr, cnt in top]
        answer["summary"] = f"Top crime: {top[0][0]} with {top[0][1]} cases." if top else "No data."

    return answer
