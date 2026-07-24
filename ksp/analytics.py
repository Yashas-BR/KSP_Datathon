from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from statistics import mean, pstdev
from typing import Any

from ksp.catalyst import (
    as_text,
    fetch_lookup,
    fetch_table,
    index_by_id,
    to_float,
    to_int,
)


CASE_COLUMNS = (
    "CaseMasterID,CrimeNo,CaseNo,CrimeRegisteredDate,PolicePersonID,PoliceStationID,"
    "CaseCategoryID,GravityOffenceID,CrimeMajorHeadID,CrimeMinorHeadID,CaseStatusID,"
    "CourtID,IncidentFromDate,IncidentToDate,InfoReceivedPSDate,latitude,longitude,BriefFacts"
)
ACCUSED_COLUMNS = "AccusedMasterID,CaseMasterID,AccusedName,AgeYear,GenderID,PersonID"
VICTIM_COLUMNS = "VictimMasterID,CaseMasterID,VictimName,AgeYear,GenderID,VictimPolice"
COMPLAINANT_COLUMNS = "ComplainantID,CaseMasterID,ComplainantName,AgeYear,OccupationID,ReligionID,CasteID,GenderID"


def _parse_date(value: Any) -> datetime | None:
    text = as_text(value, "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _parse_date_only(value: Any) -> datetime.date | None:
    parsed = _parse_date(value)
    return parsed.date() if parsed else None


def _days_ago(days: int) -> datetime.date:
    return (datetime.utcnow() - timedelta(days=days)).date()


def _district_and_station_indexes(req: Any):
    districts = fetch_lookup(req, "District", "DistrictID,DistrictName,StateID,Active")
    units = fetch_lookup(req, "Unit", "UnitID,UnitName,TypeID,ParentUnit,StateID,DistrictID,Active")
    district_index = index_by_id(districts, "DistrictID")
    unit_index = index_by_id(units, "UnitID")
    station_rows = [row for row in units if to_int(row.get("TypeID")) == 1]
    station_index = index_by_id(station_rows, "UnitID")
    return district_index, unit_index, station_index


def _unit_type_labels(req: Any) -> dict[str, str]:
    unit_types = fetch_lookup(req, "UnitType", "UnitTypeID,UnitTypeName,Hierarchy,Active")
    return {str(row.get("UnitTypeID")): as_text(row.get("UnitTypeName"), "Unit") for row in unit_types}


def _build_unit_tree(req: Any) -> list[dict[str, Any]]:
    units = fetch_lookup(req, "Unit", "UnitID,UnitName,TypeID,ParentUnit,StateID,DistrictID,Active")
    unit_types = _unit_type_labels(req)
    by_parent: dict[str, list[dict[str, Any]]] = defaultdict(list)
    roots: list[dict[str, Any]] = []

    for row in units:
        parent = as_text(row.get("ParentUnit"), "").strip()
        by_parent[parent].append(row)

    def build_node(row: dict[str, Any]) -> dict[str, Any]:
        unit_id = to_int(row.get("UnitID"))
        children = [build_node(child) for child in by_parent.get(str(row.get("UnitID")), [])]
        station_count = sum(1 for child in children if to_int(child.get("typeId")) == 1)
        station_count += sum(to_int(child.get("stationCount"), 0) or 0 for child in children)
        return {
            "unitId": unit_id,
            "unitName": row.get("UnitName"),
            "typeId": to_int(row.get("TypeID")),
            "typeName": unit_types.get(str(row.get("TypeID")), "Unit"),
            "districtId": to_int(row.get("DistrictID")),
            "parentUnitId": to_int(row.get("ParentUnit")),
            "active": to_int(row.get("Active"), 1),
            "children": children,
            "stationCount": station_count,
        }

    for row in units:
        if not as_text(row.get("ParentUnit"), "").strip() and to_int(row.get("TypeID")) == 2:
            roots.append(build_node(row))

    roots.sort(key=lambda item: as_text(item.get("unitName"), ""))
    return roots


def _lookup_indexes(req: Any):
    crime_heads = index_by_id(fetch_lookup(req, "CrimeHead", "CrimeHeadID,CrimeGroupName,Active"), "CrimeHeadID")
    crime_sub_heads = index_by_id(fetch_lookup(req, "CrimeSubHead", "CrimeSubHeadID,CrimeHeadID,CrimeHeadName,SeqID"), "CrimeSubHeadID")
    case_categories = index_by_id(fetch_lookup(req, "CaseCategory", "CaseCategoryID,LookupValue"), "CaseCategoryID")
    gravity = index_by_id(fetch_lookup(req, "GravityOffence", "GravityOffenceID,LookupValue"), "GravityOffenceID")
    status = index_by_id(fetch_lookup(req, "CaseStatusMaster", "CaseStatusID,CaseStatusName"), "CaseStatusID")
    courts = index_by_id(fetch_lookup(req, "Court", "CourtID,CourtName,DistrictID,StateID,Active"), "CourtID")
    occupation = index_by_id(fetch_lookup(req, "OccupationMaster", "OccupationID,OccupationName"), "OccupationID")
    return {
        "crime_heads": crime_heads,
        "crime_sub_heads": crime_sub_heads,
        "case_categories": case_categories,
        "gravity": gravity,
        "status": status,
        "courts": courts,
        "occupation": occupation,
    }


def _cases_with_context(req: Any) -> list[dict[str, Any]]:
    district_index, unit_index, station_index = _district_and_station_indexes(req)
    lookups = _lookup_indexes(req)
    cases = fetch_table(req, "CaseMaster", CASE_COLUMNS)
    for row in cases:
        station_id = str(row.get("PoliceStationID") or "")
        station = station_index.get(station_id)
        district_id = station.get("DistrictID") if station else None
        row["_station"] = station or {}
        row["_district"] = district_index.get(str(district_id)) if district_id is not None else {}
        row["_district_id"] = to_int(district_id)
        row["_station_id"] = to_int(station_id)
        row["_major_head"] = lookups["crime_heads"].get(str(row.get("CrimeMajorHeadID")), {})
        row["_minor_head"] = lookups["crime_sub_heads"].get(str(row.get("CrimeMinorHeadID")), {})
        row["_status"] = lookups["status"].get(str(row.get("CaseStatusID")), {})
        row["_category"] = lookups["case_categories"].get(str(row.get("CaseCategoryID")), {})
        row["_gravity"] = lookups["gravity"].get(str(row.get("GravityOffenceID")), {})
        row["_court"] = lookups["courts"].get(str(row.get("CourtID")), {})
        row["_incident_date"] = _parse_date(row.get("IncidentFromDate"))
        row["_registered_date"] = _parse_date_only(row.get("CrimeRegisteredDate"))
        row["_hour"] = row["_incident_date"].hour if row["_incident_date"] else None
    return cases


def _filter_cases(cases: list[dict[str, Any]], district_id: int | None = None, days: int | None = None, hour: int | None = None) -> list[dict[str, Any]]:
    cutoff = _days_ago(days) if days else None
    filtered: list[dict[str, Any]] = []
    for row in cases:
        if district_id is not None and row.get("_district_id") != district_id:
            continue
        registered = row.get("_registered_date")
        if cutoff and registered and registered < cutoff:
            continue
        if hour is not None and row.get("_hour") != hour:
            continue
        filtered.append(row)
    return filtered


def _summarize_cases(cases: list[dict[str, Any]], district_index: dict[str, dict[str, Any]]) -> dict[str, Any]:
    district_counts = Counter()
    station_counts = Counter()
    crime_counts = Counter()
    hour_counts = Counter()
    markers: list[dict[str, Any]] = []
    for row in cases:
        district_id = row.get("_district_id")
        station_id = row.get("_station_id")
        crime_name = row.get("_minor_head", {}).get("CrimeHeadName") or row.get("_major_head", {}).get("CrimeGroupName") or "Unknown"
        if district_id is not None:
            district_counts[str(district_id)] += 1
        if station_id is not None:
            station_counts[str(station_id)] += 1
        crime_counts[crime_name] += 1
        hour = row.get("_hour")
        if hour is not None:
            hour_counts[str(hour)] += 1
        latitude = to_float(row.get("latitude"))
        longitude = to_float(row.get("longitude"))
        if latitude is not None and longitude is not None:
            markers.append(
                {
                    "caseId": row.get("CaseMasterID"),
                    "crimeNo": row.get("CrimeNo"),
                    "districtId": district_id,
                    "stationId": station_id,
                    "districtName": row.get("_district", {}).get("DistrictName"),
                    "stationName": row.get("_station", {}).get("UnitName"),
                    "crimeName": crime_name,
                    "latitude": latitude,
                    "longitude": longitude,
                    "severity": row.get("_gravity", {}).get("LookupValue"),
                    "facts": row.get("BriefFacts"),
                    "registeredDate": row.get("CrimeRegisteredDate"),
                }
            )

    districts = []
    for district_id, count in district_counts.most_common():
        district = district_index.get(district_id, {})
        districts.append(
            {
                "districtId": to_int(district_id),
                "districtName": district.get("DistrictName", "Unknown"),
                "caseCount": count,
            }
        )

    return {
        "districtCounts": districts,
        "stationCounts": station_counts,
        "crimeCounts": crime_counts,
        "hourCounts": hour_counts,
        "markers": markers,
    }


def _district_station_summary(cases: list[dict[str, Any]], district_index: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = defaultdict(lambda: {"districtId": None, "districtName": "Unknown", "stations": Counter(), "caseCount": 0, "crimeCounts": Counter()})
    for row in cases:
        district_id = row.get("_district_id")
        if district_id is None:
            continue
        bucket = grouped[str(district_id)]
        district = district_index.get(str(district_id), {})
        bucket["districtId"] = district_id
        bucket["districtName"] = district.get("DistrictName", "Unknown")
        bucket["caseCount"] += 1
        station_name = row.get("_station", {}).get("UnitName") or f"Station {row.get('_station_id')}"
        bucket["stations"][station_name] += 1
        crime_name = row.get("_minor_head", {}).get("CrimeHeadName") or row.get("_major_head", {}).get("CrimeGroupName") or "Unknown"
        bucket["crimeCounts"][crime_name] += 1

    output = []
    for item in sorted(grouped.values(), key=lambda value: value["caseCount"], reverse=True):
        output.append(
            {
                "districtId": item["districtId"],
                "districtName": item["districtName"],
                "caseCount": item["caseCount"],
                "topStations": [
                    {"stationName": name, "caseCount": count}
                    for name, count in item["stations"].most_common(8)
                ],
                "topCrimeTypes": [
                    {"crimeName": name, "caseCount": count}
                    for name, count in item["crimeCounts"].most_common(5)
                ],
            }
        )
    return output


def build_station_lookup_payload(req: Any, district_id: int | None = None) -> dict[str, Any]:
    district_index, _, station_index = _district_and_station_indexes(req)
    unit_tree = _build_unit_tree(req)
    districts = [
        {"districtId": to_int(row.get("DistrictID")), "districtName": row.get("DistrictName")}
        for row in district_index.values()
    ]
    stations = []
    for station in station_index.values():
        if district_id is not None and to_int(station.get("DistrictID")) != district_id:
            continue
        stations.append(
            {
                "stationId": to_int(station.get("UnitID")),
                "stationName": station.get("UnitName"),
                "districtId": to_int(station.get("DistrictID")),
                "districtName": district_index.get(str(station.get("DistrictID")), {}).get("DistrictName"),
            }
        )
    stations.sort(key=lambda item: (item["districtName"] or "", item["stationName"] or ""))
    stations_by_district: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for station in stations:
        stations_by_district[str(station["districtId"])].append(station)

    return {
        "districts": districts,
        "stations": stations,
        "stationsByDistrict": stations_by_district,
        "unitTree": unit_tree,
        "districtFilter": district_id,
    }


def build_dashboard_payload(req: Any, district_id: int | None = None, days: int = 180, hour: int | None = None) -> dict[str, Any]:
    cases = _cases_with_context(req)
    district_index, _, _ = _district_and_station_indexes(req)
    filtered = _filter_cases(cases, district_id=district_id, days=days, hour=hour)
    summary = _summarize_cases(filtered, district_index)
    station_rows = _district_station_summary(filtered, district_index)
    alerts = build_trend_alert_payload(req, district_id=district_id, days=days)["alerts"]
    hotspots = _build_hotspots(filtered, district_index)
    return {
        "selectedDistrictId": district_id,
        "selectedHour": hour,
        "windowDays": days,
        "totals": {
            "cases": len(filtered),
            "districts": len(summary["districtCounts"]),
            "stations": len(summary["stationCounts"]),
            "hotspots": len(hotspots),
            "alerts": len(alerts),
        },
        "districts": station_rows,
        "summary": {
            "districtCounts": summary["districtCounts"],
            "crimeCounts": summary["crimeCounts"].most_common(10),
            "hourCounts": summary["hourCounts"].most_common(24),
        },
        "hotspots": hotspots,
        "alerts": alerts,
        "markers": summary["markers"][:500],
        "timeSeries": _build_time_series(filtered),
    }


def _build_time_series(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    daily_counts = Counter()
    for row in cases:
        registered = row.get("_registered_date")
        if registered:
            daily_counts[registered.isoformat()] += 1
    return [{"date": key, "caseCount": daily_counts[key]} for key in sorted(daily_counts)]


def _build_hotspots(cases: list[dict[str, Any]], district_index: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in cases:
        district_id = str(row.get("_district_id") or "")
        hour = str(row.get("_hour") if row.get("_hour") is not None else "unknown")
        buckets[(district_id, hour)].append(row)

    counts = [len(value) for value in buckets.values()]
    baseline = mean(counts) if counts else 0.0
    spread = pstdev(counts) if len(counts) > 1 else 0.0
    threshold = baseline + max(spread * 1.5, 3)
    hotspots = []
    for (district_id, hour), rows in sorted(buckets.items(), key=lambda item: len(item[1]), reverse=True):
        count = len(rows)
        if count < threshold:
            continue
        district = district_index.get(district_id, {})
        crime_counter = Counter(
            row.get("_minor_head", {}).get("CrimeHeadName") or row.get("_major_head", {}).get("CrimeGroupName") or "Unknown"
            for row in rows
        )
        hotspots.append(
            {
                "districtId": to_int(district_id),
                "districtName": district.get("DistrictName", "Unknown"),
                "hour": hour,
                "caseCount": count,
                "severity": round(min(100.0, 40.0 + count * 4.0), 2),
                "topCrimeType": crime_counter.most_common(1)[0][0] if crime_counter else "Unknown",
                "topCrimeTypeCount": crime_counter.most_common(1)[0][1] if crime_counter else 0,
                "sampleCases": [
                    {
                        "caseId": row.get("CaseMasterID"),
                        "crimeNo": row.get("CrimeNo"),
                        "stationName": row.get("_station", {}).get("UnitName"),
                        "latitude": to_float(row.get("latitude")),
                        "longitude": to_float(row.get("longitude")),
                    }
                    for row in rows[:5]
                ],
            }
        )
    return hotspots[:20]


def build_trend_alert_payload(req: Any, district_id: int | None = None, days: int = 180) -> dict[str, Any]:
    cases = _cases_with_context(req)
    filtered = _filter_cases(cases, district_id=district_id, days=days)
    if not filtered:
        return {"alerts": [], "windowDays": days, "selectedDistrictId": district_id}

    district_index, _, _ = _district_and_station_indexes(req)
    grouped: dict[tuple[str, str, str], Counter] = defaultdict(Counter)
    for row in filtered:
        registered = row.get("_registered_date")
        if not registered:
            continue
        key = (
            str(row.get("_district_id") or ""),
            str(row.get("_station_id") or ""),
            row.get("_minor_head", {}).get("CrimeHeadName") or row.get("_major_head", {}).get("CrimeGroupName") or "Unknown",
        )
        grouped[key][registered.isoformat()] += 1

    alerts = []
    for (district_key, station_key, crime_name), day_counter in grouped.items():
        days_sorted = sorted(day_counter)
        if len(days_sorted) < 10:
            continue
        signal_window = 14
        baseline_window = 90
        all_dates = [datetime.fromisoformat(day).date() for day in days_sorted]
        latest_day = max(all_dates)
        signal_start = latest_day - timedelta(days=signal_window - 1)
        baseline_days = [(signal_start - timedelta(days=i)).isoformat() for i in range(signal_window, signal_window + baseline_window)]
        signal_days = [(signal_start + timedelta(days=i)).isoformat() for i in range(signal_window)]
        baseline_series = [day_counter.get(day, 0) for day in baseline_days]
        signal_series = [day_counter.get(day, 0) for day in signal_days]
        baseline_mean = mean(baseline_series) if baseline_series else 0.0
        baseline_std = pstdev(baseline_series) if len(baseline_series) > 1 else 0.0
        expected = baseline_mean * signal_window
        observed = sum(signal_series)
        z_score = 0.0
        if baseline_std > 0:
            z_score = (observed - expected) / max(baseline_std * (signal_window ** 0.5), 1.0)
        trigger = observed >= max(expected * 2, expected + 2 * baseline_std * (signal_window ** 0.5), 6)
        if not trigger:
            continue
        district = district_index.get(district_key, {})
        alerts.append(
            {
                "districtId": to_int(district_key),
                "districtName": district.get("DistrictName", "Unknown"),
                "stationId": to_int(station_key),
                "stationName": next((row.get("_station", {}).get("UnitName") for row in filtered if str(row.get("_station_id")) == station_key), None),
                "crimeName": crime_name,
                "observedCount": observed,
                "expectedCount": round(expected, 2),
                "baselineDailyAverage": round(baseline_mean, 3),
                "baselineStdDev": round(baseline_std, 3),
                "zScore": round(z_score, 2),
                "severity": "critical" if observed >= expected * 3 else "high",
            }
        )
    alerts.sort(key=lambda item: (item["severity"] == "critical", item["observedCount"]), reverse=True)
    return {"alerts": alerts[:30], "windowDays": days, "selectedDistrictId": district_id}


def build_network_payload(req: Any, district_id: int | None = None, focus_person_id: str | None = None, top: int = 35) -> dict[str, Any]:
    cases = _cases_with_context(req)
    district_index, _, station_index = _district_and_station_indexes(req)
    accused_rows = fetch_table(req, "Accused", ACCUSED_COLUMNS)
    victim_rows = fetch_table(req, "Victim", VICTIM_COLUMNS)

    case_by_id = {str(row.get("CaseMasterID")): row for row in cases}
    accused_by_case: dict[str, list[dict[str, Any]]] = defaultdict(list)
    victims_by_case: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in accused_rows:
        case = case_by_id.get(str(row.get("CaseMasterID")))
        if not case:
            continue
        if district_id is not None and case.get("_district_id") != district_id:
            continue
        accused_by_case[str(row.get("CaseMasterID"))].append(row)
    for row in victim_rows:
        case = case_by_id.get(str(row.get("CaseMasterID")))
        if not case:
            continue
        if district_id is not None and case.get("_district_id") != district_id:
            continue
        victims_by_case[str(row.get("CaseMasterID"))].append(row)

    person_stats: dict[str, dict[str, Any]] = defaultdict(lambda: {"cases": set(), "caseCount": 0, "crimeCounts": Counter(), "districtCounts": Counter(), "stationCounts": Counter(), "names": Counter()})
    case_links: Counter[tuple[str, str]] = Counter()
    location_nodes: dict[str, dict[str, Any]] = {}
    victim_nodes: dict[str, dict[str, Any]] = {}

    for case_id, accused_list in accused_by_case.items():
        case = case_by_id[case_id]
        district = case.get("_district", {})
        station = case.get("_station", {})
        crime_name = case.get("_minor_head", {}).get("CrimeHeadName") or case.get("_major_head", {}).get("CrimeGroupName") or "Unknown"
        district_name = district.get("DistrictName", "Unknown")
        station_name = station.get("UnitName", f"Station {case.get('_station_id')}")
        location_key = f"station:{case.get('_station_id')}"
        location_nodes[location_key] = {
            "id": location_key,
            "label": station_name,
            "type": "station",
            "districtId": case.get("_district_id"),
            "districtName": district_name,
            "caseCount": location_nodes.get(location_key, {}).get("caseCount", 0) + 1,
        }
        for accused in accused_list:
            person_id = as_text(accused.get("PersonID"), "").strip() or f"accused:{accused.get('AccusedMasterID')}"
            stats = person_stats[person_id]
            stats["cases"].add(case_id)
            stats["caseCount"] = len(stats["cases"])
            stats["crimeCounts"][crime_name] += 1
            stats["districtCounts"][district_name] += 1
            stats["stationCounts"][station_name] += 1
            stats["names"][accused.get("AccusedName") or person_id] += 1
        for left in range(len(accused_list)):
            left_id = as_text(accused_list[left].get("PersonID"), "").strip() or f"accused:{accused_list[left].get('AccusedMasterID')}"
            for right in range(left + 1, len(accused_list)):
                right_id = as_text(accused_list[right].get("PersonID"), "").strip() or f"accused:{accused_list[right].get('AccusedMasterID')}"
                ordered = tuple(sorted((left_id, right_id)))
                case_links[ordered] += 1

        for victim in victims_by_case.get(case_id, []):
            victim_key = f"victim:{victim.get('VictimMasterID')}"
            victim_nodes[victim_key] = {
                "id": victim_key,
                "label": victim.get("VictimName") or victim_key,
                "type": "victim",
                "caseId": case_id,
            }

    focus_ids = {focus_person_id.strip()} if focus_person_id else set()
    ranked_people = sorted(person_stats.items(), key=lambda item: (item[1]["caseCount"], sum(item[1]["crimeCounts"].values())), reverse=True)
    if focus_ids:
        ranked_people = [item for item in ranked_people if item[0] in focus_ids] + [item for item in ranked_people if item[0] not in focus_ids]
    ranked_people = ranked_people[: max(top, 10)]

    selected_people = {person_id for person_id, _ in ranked_people}
    for (left_id, right_id), weight in case_links.items():
        if left_id in selected_people or right_id in selected_people or focus_ids & {left_id, right_id}:
            selected_people.add(left_id)
            selected_people.add(right_id)

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    for person_id, stats in ranked_people:
        if person_id not in selected_people:
            continue
        primary_name = stats["names"].most_common(1)[0][0] if stats["names"] else person_id
        primary_crime = stats["crimeCounts"].most_common(1)[0][0] if stats["crimeCounts"] else "Unknown"
        home_district = stats["districtCounts"].most_common(1)[0][0] if stats["districtCounts"] else "Unknown"
        nodes.append(
            {
                "id": person_id,
                "label": primary_name,
                "type": "offender",
                "title": f"Cases: {stats['caseCount']}\nSpecialty: {primary_crime}\nPrimary district: {home_district}",
                "caseCount": stats["caseCount"],
                "specialtyCrime": primary_crime,
                "primaryDistrict": home_district,
            }
        )
        for station_name, count in stats["stationCounts"].most_common(3):
            station_id = next((case["_station_id"] for case in cases if case.get("_station", {}).get("UnitName") == station_name), None)
            if station_id is None:
                continue
            station_node_id = f"station:{station_id}"
            if station_node_id not in location_nodes:
                location = station_index.get(str(station_id), {})
                location_nodes[station_node_id] = {
                    "id": station_node_id,
                    "label": location.get("UnitName", station_name),
                    "type": "station",
                    "districtId": to_int(location.get("DistrictID")),
                    "districtName": district_index.get(str(location.get("DistrictID")), {}).get("DistrictName"),
                    "caseCount": count,
                }
    for node in location_nodes.values():
        nodes.append(node)
    for node in victim_nodes.values():
        nodes.append(node)

    unique_nodes = {node["id"]: node for node in nodes}
    nodes = list(unique_nodes.values())

    for person_id, stats in person_stats.items():
        if person_id not in selected_people:
            continue
        for station_name, count in stats["stationCounts"].most_common(3):
            station_id = next((case["_station_id"] for case in cases if case.get("_station", {}).get("UnitName") == station_name), None)
            if station_id is None:
                continue
            station_node_id = f"station:{station_id}"
            if station_node_id in unique_nodes:
                edges.append(
                    {
                        "from": person_id,
                        "to": station_node_id,
                        "label": str(count),
                        "value": count,
                        "type": "association",
                    }
                )
    for (left_id, right_id), weight in case_links.items():
        if left_id in selected_people and right_id in selected_people and weight > 0:
            edges.append(
                {
                    "from": left_id,
                    "to": right_id,
                    "label": f"{weight} shared cases",
                    "value": weight,
                    "type": "coaccused",
                }
            )

    repeat_offenders = []
    for person_id, stats in ranked_people:
        repeat_offenders.append(
            {
                "personId": person_id,
                "name": stats["names"].most_common(1)[0][0] if stats["names"] else person_id,
                "caseCount": stats["caseCount"],
                "specialtyCrime": stats["crimeCounts"].most_common(1)[0][0] if stats["crimeCounts"] else "Unknown",
                "districts": [
                    {"districtName": name, "count": count}
                    for name, count in stats["districtCounts"].most_common(4)
                ],
                "stations": [
                    {"stationName": name, "count": count}
                    for name, count in stats["stationCounts"].most_common(4)
                ],
                "modes": [
                    {"crimeName": name, "count": count}
                    for name, count in stats["crimeCounts"].most_common(4)
                ],
            }
        )

    associations = [
        {"offenderA": left, "offenderB": right, "sharedCases": weight}
        for (left, right), weight in case_links.items()
        if left in selected_people and right in selected_people and weight > 0
    ]
    associations.sort(key=lambda item: item["sharedCases"], reverse=True)

    return {
        "nodes": nodes,
        "edges": edges,
        "repeatOffenders": repeat_offenders[:50],
        "associations": associations[:100],
        "selectedPeople": sorted(selected_people),
        "totalCases": len(accused_by_case),
    }


def build_occupation_correlation_payload(req: Any, district_id: int | None = None, days: int = 180) -> dict[str, Any]:
    cases = _cases_with_context(req)
    filtered = _filter_cases(cases, district_id=district_id, days=days)
    complainants = fetch_table(req, "ComplainantDetails", COMPLAINANT_COLUMNS)
    occupation_lookup = index_by_id(fetch_lookup(req, "OccupationMaster", "OccupationID,OccupationName"), "OccupationID")
    complainant_by_case: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in complainants:
        complainant_by_case[str(row.get("CaseMasterID"))].append(row)

    occupation_counts = Counter()
    crime_by_occupation: dict[str, Counter] = defaultdict(Counter)
    district_by_occupation: dict[str, Counter] = defaultdict(Counter)
    age_buckets: Counter = Counter()
    gender_counts: Counter = Counter()

    for case in filtered:
        crime_name = case.get("_minor_head", {}).get("CrimeHeadName") or case.get("_major_head", {}).get("CrimeGroupName") or "Unknown"
        district_name = case.get("_district", {}).get("DistrictName", "Unknown")
        for complainant in complainant_by_case.get(str(case.get("CaseMasterID")), []):
            occupation_id = as_text(complainant.get("OccupationID"), "").strip()
            occupation_name = occupation_lookup.get(occupation_id, {}).get("OccupationName", "Unknown")
            occupation_counts[occupation_name] += 1
            crime_by_occupation[occupation_name][crime_name] += 1
            district_by_occupation[occupation_name][district_name] += 1
            age = to_int(complainant.get("AgeYear"))
            if age is not None:
                if age < 18:
                    age_buckets["under_18"] += 1
                elif age < 30:
                    age_buckets["18_29"] += 1
                elif age < 45:
                    age_buckets["30_44"] += 1
                elif age < 60:
                    age_buckets["45_59"] += 1
                else:
                    age_buckets["60_plus"] += 1
            gender_counts[as_text(complainant.get("GenderID"), "Unknown")] += 1

    heatmap = []
    for occupation_name, crime_counter in occupation_counts.most_common(15):
        top_crimes = crime_by_occupation[occupation_name].most_common(6)
        heatmap.append(
            {
                "occupation": occupation_name,
                "caseCount": crime_counter,
                "topCrimeTypes": [
                    {"crimeName": name, "count": count}
                    for name, count in top_crimes
                ],
                "topDistricts": [
                    {"districtName": name, "count": count}
                    for name, count in district_by_occupation[occupation_name].most_common(4)
                ],
            }
        )

    return {
        "districtId": district_id,
        "windowDays": days,
        "occupationHeatmap": heatmap,
        "ageBuckets": dict(age_buckets),
        "genderCounts": dict(gender_counts),
        "insights": _build_correlation_insights(heatmap),
    }


def _build_correlation_insights(heatmap: list[dict[str, Any]]) -> list[str]:
    insights = []
    if not heatmap:
        return insights
    top = heatmap[0]
    if top["topCrimeTypes"]:
        insights.append(
            f"{top['occupation']} complainants are most concentrated in {top['topCrimeTypes'][0]['crimeName']} cases."
        )
    if len(heatmap) > 1:
        insights.append(
            f"{heatmap[1]['occupation']} appears as the next strongest occupational segment in the selected window."
        )
    insights.append("Religion and caste fields are intentionally excluded from the correlation and prediction features.")
    return insights