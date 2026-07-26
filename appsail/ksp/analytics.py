"""Analytics payload builders — all data from Catalyst Data Store."""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Dict, List, Optional

from .data import (
    crime_head_by_id, crime_subhead_by_id, district_by_id,
    get_accused, get_cases, get_districts, get_units,
    parse_date, status_by_id, unit_by_id,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _district_of(case: Dict) -> str:
    return unit_by_id().get(case.get("PoliceStationID", ""), {}).get("districtId", "")


def _crime_label(case: Dict) -> str:
    sub = crime_subhead_by_id().get(case.get("CrimeMinorHeadID", ""), "")
    return sub or crime_head_by_id().get(case.get("CrimeMajorHeadID", ""), "Unknown")


# ── Meta / lookups ────────────────────────────────────────────────────────────

def build_station_lookup_payload(request, district_id: Optional[int] = None) -> Dict:
    districts = [
        {"id": d["DistrictID"], "name": d["DistrictName"],
         "districtId": d["DistrictID"], "districtName": d["DistrictName"]}
        for d in get_districts()
    ]
    units = get_units()
    dbi = district_by_id()
    stations = [
        {"id": u["UnitID"], "name": u["UnitName"], "districtId": u["DistrictID"],
         "stationId": u["UnitID"], "stationName": u["UnitName"],
         "districtName": dbi.get(u["DistrictID"], "")}
        for u in units
        if not district_id or str(u.get("DistrictID", "")) == str(district_id)
    ]
    return {"districts": districts, "stations": stations}


# ── Dashboard ─────────────────────────────────────────────────────────────────

def build_dashboard_payload(request, district_id=None, days=365, hour=None) -> Dict:
    cases = get_cases(days, district_id)
    crime_c: Counter = Counter()
    status_c: Counter = Counter()
    monthly: Dict[str, int] = defaultdict(int)
    hourly: Dict[int, int] = defaultdict(int)
    markers = []

    uby = unit_by_id()
    dbi = district_by_id()
    dist_set = set()
    station_set = set()

    for c in cases:
        crime_c[_crime_label(c)] += 1
        status_c[status_by_id().get(c.get("CaseStatusID", ""), "Unknown")] += 1
        dt = parse_date(c.get("IncidentFromDate", ""))
        if dt:
            monthly[dt.strftime("%Y-%m")] += 1
            hourly[dt.hour] += 1
        sid = c.get("PoliceStationID", "")
        unit = uby.get(sid, {})
        did = unit.get("districtId", "")
        dist_set.add(did)
        station_set.add(sid)
        try:
            lat, lng = float(c.get("latitude", 0)), float(c.get("longitude", 0))
            if lat and lng:
                markers.append({
                    "lat": lat, "lng": lng, "latitude": lat, "longitude": lng,
                    "crime": _crime_label(c), "crimeName": _crime_label(c),
                    "date": c.get("IncidentFromDate", ""), "registeredDate": c.get("IncidentFromDate", ""),
                    "caseId": c.get("Casemasterid", ""), "crimeNo": c.get("Casemasterid", ""),
                    "stationId": sid, "districtId": did,
                    "stationName": unit.get("name", ""),
                    "districtName": dbi.get(did, ""),
                    "facts": "", "severity": "Recorded",
                })
        except (ValueError, TypeError):
            pass

    # Build hotspots from top station clusters
    station_counts: Counter = Counter(c.get("PoliceStationID", "") for c in cases)
    avg = len(cases) / max(len(station_counts), 1)
    hotspots = []
    alerts = []
    for sid, cnt in station_counts.most_common(20):
        unit = uby.get(sid, {})
        did = unit.get("districtId", "")
        hotspots.append({
            "stationId": sid, "districtId": did,
            "stationName": unit.get("name", ""),
            "districtName": dbi.get(did, ""),
            "caseCount": cnt, "hour": 0, "topCrimeType": "", "severity": cnt,
        })
        if cnt > avg * 2:
            alerts.append({
                "stationId": sid, "districtId": did,
                "stationName": unit.get("name", ""),
                "districtName": dbi.get(did, ""),
                "crimeName": "", "observedCount": cnt,
                "expectedCount": round(avg, 1), "zScore": round((cnt - avg) / max(avg ** 0.5, 1), 1),
                "severity": "high",
            })

    return {
        "dashboard": {
            "totalCases": len(cases),
            "topCrimes": [{"crime": k, "count": v} for k, v in crime_c.most_common(10)],
            "monthlyTrend": [{"month": k, "count": v} for k, v in sorted(monthly.items())],
            "hourlyDistribution": [{"hour": h, "count": hourly[h]} for h in range(24)],
            "statusDistribution": [{"status": k, "count": v} for k, v in status_c.most_common()],
            "markers": markers[:500],
            "hotspots": hotspots,
            "alerts": alerts,
            "totals": {
                "cases": len(cases),
                "districts": len(dist_set),
                "stations": len(station_set),
                "hotspots": len(hotspots),
                "alerts": len(alerts),
            },
            "summary": {
                "hourCounts": [[h, hourly[h]] for h in range(24)],
                "crimeCounts": [[k, v] for k, v in crime_c.most_common(10)],
                "districtCounts": [],
            },
            "windowDays": days,
        }
    }


# ── Trend alerts ──────────────────────────────────────────────────────────────

def build_trend_alert_payload(request, district_id=None, days=365) -> Dict:
    recent = get_cases(days // 2, district_id)
    baseline = get_cases(days, district_id)

    recent_c: Counter = Counter(_crime_label(c) for c in recent)
    baseline_c: Counter = Counter(_crime_label(c) for c in baseline)

    alerts = []
    for crime, rc in recent_c.most_common(20):
        bc = baseline_c.get(crime, 1)
        ratio = rc / (bc / 2)
        if ratio > 1.3:
            alerts.append({
                "crime": crime, "recentCount": rc,
                "baselineAvg": round(bc / 2, 1), "ratio": round(ratio, 2),
                "severity": "high" if ratio > 2 else "medium",
            })
    alerts.sort(key=lambda x: x["ratio"], reverse=True)

    monthly_by_crime: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for c in baseline:
        dt = parse_date(c.get("CrimeRegisteredDate", ""))
        if dt:
            monthly_by_crime[_crime_label(c)][dt.strftime("%Y-%m")] += 1

    trends = [
        {"crime": crime, "monthly": [{"month": m, "count": cnt} for m, cnt in sorted(months.items())]}
        for crime, months in list(monthly_by_crime.items())[:10]
    ]
    return {"alerts": alerts[:10], "trends": trends}


# ── Network / link analysis ───────────────────────────────────────────────────

def build_network_payload(request, district_id=None, focus_person_id=None, top=35) -> Dict:
    cases = get_cases(365, district_id)
    case_ids = [c["Casemasterid"] for c in cases]
    accused_list = get_accused(case_ids)

    name_to_cases: Dict[str, set] = defaultdict(set)
    name_to_info: Dict[str, Dict] = {}
    for a in accused_list:
        name = a.get("AccusedName", "Unknown")
        name_to_cases[name].add(a.get("CaseMasterID", ""))
        name_to_info[name] = a

    repeat_offenders = sorted(
        [{"name": n, "caseCount": len(cids),
          "personId": name_to_info[n].get("PersonID", ""),
          "age": name_to_info[n].get("AgeYear", ""),
          "gender": name_to_info[n].get("GenderID", "")}
         for n, cids in name_to_cases.items() if len(cids) > 1],
        key=lambda x: x["caseCount"], reverse=True
    )

    nodes, edges, seen = [], [], set()
    case_by_id = {c["Casemasterid"]: c for c in cases}
    top_accused = sorted(name_to_cases.items(), key=lambda x: len(x[1]), reverse=True)[:top]

    for name, cids in top_accused:
        nid = f"acc_{name.replace(' ', '_')}"
        nodes.append({"id": nid, "label": name, "type": "accused", "caseCount": len(cids)})
        seen.add(nid)
        for cid in list(cids)[:5]:
            loc = f"case_{cid}"
            if loc not in seen and cid in case_by_id:
                nodes.append({"id": loc, "label": _crime_label(case_by_id[cid]), "type": "case", "caseId": cid})
                seen.add(loc)
            edges.append({"from": nid, "to": loc, "type": "involved_in"})

    top_names = {n for n, _ in top_accused}
    case_to_acc: Dict[str, List[str]] = defaultdict(list)
    for a in accused_list:
        if a.get("AccusedName") in top_names:
            case_to_acc[a.get("CaseMasterID", "")].append(a["AccusedName"])
    for cid, names in case_to_acc.items():
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                edges.append({"from": f"acc_{names[i].replace(' ','_')}", "to": f"acc_{names[j].replace(' ','_')}", "type": "co_accused"})

    return {"network": {"nodes": nodes, "edges": edges[:300]}, "repeatOffenders": repeat_offenders[:50]}


# ── Occupation / demographic correlation ──────────────────────────────────────

def build_occupation_correlation_payload(request, district_id=None, days=365) -> Dict:
    cases = get_cases(days, district_id)
    case_map = {c["Casemasterid"]: c for c in cases}
    accused_list = get_accused(list(case_map.keys()))

    crime_by_age: Dict[str, List[int]] = defaultdict(list)
    gender_crime: Dict[str, Counter] = defaultdict(Counter)
    age_groups: Counter = Counter()

    for a in accused_list:
        c = case_map.get(a.get("CaseMasterID", ""))
        if not c:
            continue
        crime = _crime_label(c)
        try:
            age = int(a.get("AgeYear", 0))
        except (ValueError, TypeError):
            age = 0
        crime_by_age[crime].append(age)
        gender_crime[a.get("GenderID", "Unknown")][crime] += 1
        bucket = "Under 18" if age < 18 else "18-24" if age < 25 else "25-34" if age < 35 else "35-49" if age < 50 else "50+"
        age_groups[bucket] += 1

    return {
        "ageCrimeCorrelation": sorted(
            [{"crime": cr, "avgAge": round(sum(a)/len(a), 1), "count": len(a)} for cr, a in crime_by_age.items() if a],
            key=lambda x: x["count"], reverse=True
        )[:10],
        "genderCrimeDistribution": [
            {"gender": "Male" if g == "M" else "Female" if g == "F" else g,
             "crimes": [{"crime": cr, "count": cnt} for cr, cnt in ctr.most_common(5)]}
            for g, ctr in gender_crime.items()
        ],
        "ageGroupDistribution": [{"group": k, "count": v} for k, v in age_groups.most_common()],
    }


# ── District map ──────────────────────────────────────────────────────────────

def build_district_map_payload(request, days=365) -> Dict:
    cases = get_cases(days)
    dist_counts: Counter = Counter()
    dist_crimes: Dict[str, Counter] = defaultdict(Counter)
    dbi = district_by_id()

    for c in cases:
        dname = dbi.get(_district_of(c), "Unknown")
        dist_counts[dname] += 1
        dist_crimes[dname][_crime_label(c)] += 1

    return {"districts": [
        {"district": d, "totalCases": cnt,
         "topCrime": dist_crimes[d].most_common(1)[0][0] if dist_crimes[d] else "Unknown",
         "crimeBreakdown": [{"crime": cr, "count": c} for cr, c in dist_crimes[d].most_common(5)]}
        for d, cnt in dist_counts.most_common()
    ]}


# ── Crime hotspots ────────────────────────────────────────────────────────────

def build_crime_hotspots_payload(request) -> Dict:
    days = request.args.get("days", default=365, type=int)
    district_id = request.args.get("district_id", type=int)
    cases = get_cases(days, district_id)

    clusters: List[Dict] = []
    for c in cases:
        try:
            lat, lng = float(c.get("latitude", 0)), float(c.get("longitude", 0))
            if not lat or not lng:
                continue
        except (ValueError, TypeError):
            continue
        merged = False
        for cl in clusters:
            if abs(cl["lat"] - lat) < 0.05 and abs(cl["lng"] - lng) < 0.05:
                cl["weight"] += 1
                merged = True
                break
        if not merged:
            clusters.append({"lat": lat, "lng": lng, "crime": _crime_label(c), "weight": 1})

    clusters.sort(key=lambda x: x["weight"], reverse=True)
    return {"hotspots": clusters[:200]}


# ── Socio-predictive ──────────────────────────────────────────────────────────

def build_socio_predictive_payload(request, district_id=None, days=180) -> Dict:
    cases = get_cases(days, district_id)
    recent = get_cases(30, district_id)
    dbi = district_by_id()

    hour_c: Counter = Counter()
    dow_c: Counter = Counter()
    dist_c: Counter = Counter()

    for c in cases:
        idt = parse_date(c.get("IncidentFromDate", ""))
        if idt:
            hour_c[idt.hour] += 1
        dt = parse_date(c.get("CrimeRegisteredDate", ""))
        if dt:
            dow_c[dt.strftime("%A")] += 1
        dist_c[dbi.get(_district_of(c), "Unknown")] += 1

    recent_dist: Counter = Counter(dbi.get(_district_of(c), "Unknown") for c in recent)
    max_cnt = max(dist_c.values(), default=1)

    anomalies = []
    for d, cnt in recent_dist.most_common():
        expected = dist_c.get(d, 1) * (30 / days)
        if expected > 0 and cnt / expected > 1.5:
            anomalies.append({"district": d, "recentCount": cnt,
                               "expectedCount": round(expected, 1),
                               "anomalyScore": round(cnt / expected, 2)})

    return {
        "peakHours": [{"hour": h, "count": hour_c[h]} for h in range(24)],
        "dayOfWeekRisk": [{"day": d, "count": dow_c[d]} for d in ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]],
        "districtRiskScores": [{"district": d, "count": cnt, "riskScore": round(cnt/max_cnt*100, 1)} for d, cnt in dist_c.most_common(15)],
        "anomalies": anomalies[:10],
    }
