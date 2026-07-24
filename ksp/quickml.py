from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Request as FlaskRequest

from ksp.analytics import build_dashboard_payload
from ksp.catalyst import as_text, fetch_lookup, index_by_id, to_int
from ksp.config import load_config


NLQ_SYSTEM_RULES = """
You are the Karnataka State Police analytics assistant.
Return a strict JSON object with these keys:
- intent: concise intent summary
- query: a single ZCQL SELECT statement against one primary table only
- answer: a short natural-language answer template
- citations: array of field names or table names used
- assumptions: array of explicit assumptions

Rules:
1. Use SELECT only.
2. Never use JOIN or HAVING.
3. Stay within Catalyst ZCQL limits and keep LIMIT <= 300.
4. Prefer CaseMaster as the primary table for case searches.
5. Use lookup names only when the backend supplies IDs.
""".strip()


def _post_json(url: str, payload: dict[str, Any], timeout: float, api_key: str | None = None) -> dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as error:
        return {"error": f"HTTP {error.code}: {error.reason}"}
    except URLError as error:
        return {"error": str(error.reason)}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw": raw}


def _call_endpoint(url: str | None, payload: dict[str, Any]) -> dict[str, Any]:
    config = load_config()
    if not url:
        return {"error": "QuickML endpoint is not configured yet.", "payload": payload}
    return _post_json(url, payload, timeout=config.request_timeout_seconds, api_key=config.quickml_api_key)


def build_quickml_risk_payload(req: FlaskRequest, body: dict[str, Any]) -> dict[str, Any]:
    config = load_config()
    district_id = body.get("district_id")
    days = int(body.get("days", 180))
    summary = build_dashboard_payload(req, district_id=to_int(district_id), days=days)
    payload = {
        "mode": "risk-scoring",
        "windowDays": days,
        "districtId": district_id,
        "features": summary["summary"],
        "hotspots": summary["hotspots"],
        "alerts": summary["alerts"],
    }
    result = _call_endpoint(config.quickml_risk_url, payload)
    return {"request": payload, "result": result}


def build_quickml_anomaly_payload(req: FlaskRequest, body: dict[str, Any]) -> dict[str, Any]:
    config = load_config()
    district_id = body.get("district_id")
    days = int(body.get("days", 180))
    summary = build_dashboard_payload(req, district_id=to_int(district_id), days=days)
    payload = {
        "mode": "anomaly-detection",
        "windowDays": days,
        "districtId": district_id,
        "series": summary["timeSeries"],
        "hotspots": summary["hotspots"],
        "alerts": summary["alerts"],
    }
    result = _call_endpoint(config.quickml_anomaly_url, payload)
    return {"request": payload, "result": result}


def _resolve_district_context(req: FlaskRequest, question: str) -> dict[str, Any]:
    district_lookup = index_by_id(fetch_lookup(req, "District", "DistrictID,DistrictName,StateID,Active"), "DistrictID")
    station_rows = fetch_lookup(req, "Unit", "UnitID,UnitName,TypeID,ParentUnit,StateID,DistrictID,Active")
    name_to_district_id: dict[str, int] = {}
    for row in district_lookup.values():
        name_to_district_id[row.get("DistrictName", "").lower()] = to_int(row.get("DistrictID")) or 0
    district_id = None
    for name, value in name_to_district_id.items():
        if name and name in question.lower():
            district_id = value
            break
    station_match = None
    for station in station_rows:
        station_name = as_text(station.get("UnitName"), "").lower()
        if station_name and station_name in question.lower():
            station_match = station
            district_id = to_int(station.get("DistrictID"))
            break
    return {"districtId": district_id, "station": station_match}


def _build_prompt(req: FlaskRequest, question: str) -> dict[str, Any]:
    context = _resolve_district_context(req, question)
    sample_dashboard = build_dashboard_payload(req, district_id=context["districtId"], days=180)
    schema_hint = {
        "primaryTables": ["CaseMaster", "Accused", "Victim", "ComplainantDetails", "Unit", "District", "CrimeSubHead"],
        "availableFilters": ["district", "station", "crimeType", "dateRange", "hourOfDay"],
        "knownDistrictId": context["districtId"],
        "knownStation": context["station"]["UnitName"] if context["station"] else None,
    }
    return {
        "system": NLQ_SYSTEM_RULES,
        "question": question,
        "schemaHint": schema_hint,
        "sampleFacts": sample_dashboard["summary"],
        "format": "strict json",
    }


def _extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("{"):
        return json.loads(text)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])
    return {"answer": text}


def _validate_generated_query(query: str) -> str:
    cleaned = query.strip().rstrip(";")
    forbidden = [" join ", " having ", " insert ", " update ", " delete ", " drop ", " alter "]
    lower = f" {cleaned.lower()} "
    if not cleaned.lower().startswith("select"):
        raise ValueError("Generated query must start with SELECT.")
    if any(token in lower for token in forbidden):
        raise ValueError("Generated query contains unsupported SQL features for Catalyst ZCQL.")
    if " limit " not in lower:
        cleaned = f"{cleaned} LIMIT 300"
    return cleaned


def build_nlq_payload(req: FlaskRequest, body: dict[str, Any]) -> dict[str, Any]:
    question = as_text(body.get("question"), "").strip()
    if not question:
        return {"error": "question is required"}

    config = load_config()
    prompt = _build_prompt(req, question)
    llm_response = _call_endpoint(config.quickml_llm_url, prompt)

    if "error" in llm_response:
        return {"question": question, "error": llm_response["error"], "prompt": prompt}

    if isinstance(llm_response, dict):
        raw_text = llm_response.get("answer") or llm_response.get("response") or llm_response.get("text") or json.dumps(llm_response)
    else:
        raw_text = as_text(llm_response, "")

    parsed = _extract_json_object(raw_text)
    generated_query = parsed.get("query", "")
    if not generated_query:
        return {"question": question, "error": "The LLM did not return a query.", "llmResponse": llm_response}

    safe_query = _validate_generated_query(generated_query)
    try:
        from ksp.catalyst import execute_zcql
        rows = execute_zcql(req, safe_query)
    except Exception as error:
        return {"question": question, "query": safe_query, "error": str(error), "llmResponse": parsed}

    citations = parsed.get("citations", []) if isinstance(parsed.get("citations", []), list) else []
    answer = parsed.get("answer") or f"Found {len(rows)} matching records for your question."
    if rows and "Found" not in answer:
        answer = f"{answer} I found {len(rows)} matching rows."
    return {
        "question": question,
        "query": safe_query,
        "answer": answer,
        "citations": citations,
        "assumptions": parsed.get("assumptions", []),
        "rows": rows,
        "llmRaw": llm_response,
    }