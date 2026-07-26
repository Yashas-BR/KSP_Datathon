"""Fetches all data from Catalyst Data Store using zcatalyst_sdk ZCQL."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import zcatalyst_sdk

logger = logging.getLogger("ksp.data")

# ── SDK ───────────────────────────────────────────────────────────────────────

def _zcql():
    return zcatalyst_sdk.initialize().zcql()


def _q(sql: str) -> List[Dict]:
    try:
        rows = _zcql().execute_query(sql)
        return rows if isinstance(rows, list) else []
    except Exception as e:
        logger.error("ZCQL error: %s | %s", e, sql)
        return []


# ── Simple in-process cache (reset on each AppSail cold start) ────────────────

_CACHE: Dict[str, List[Dict]] = {}


def _cached(key: str, sql: str) -> List[Dict]:
    if key not in _CACHE:
        _CACHE[key] = _q(sql)
    return _CACHE[key]


# ── Lookup tables ─────────────────────────────────────────────────────────────

def get_districts() -> List[Dict]:
    return _cached("districts",
        "SELECT DistrictID, DistrictName FROM District WHERE Active = '1'")


def get_units() -> List[Dict]:
    return _cached("units",
        "SELECT UnitID, UnitName, TypeID, DistrictID FROM Unit WHERE Active = '1'")


def get_crime_heads() -> List[Dict]:
    return _cached("crime_heads",
        "SELECT CrimeHeadID, CrimeGroupName FROM CrimeHead")


def get_crime_subheads() -> List[Dict]:
    return _cached("crime_subheads",
        "SELECT CrimeSubHeadID, CrimeHeadID, CrimeHeadName FROM CrimeSubHead")


def get_case_statuses() -> List[Dict]:
    return _cached("statuses",
        "SELECT CaseStatusID, CaseStatusName FROM CaseStatusName")


# ── Lookup dicts ──────────────────────────────────────────────────────────────

def district_by_id() -> Dict[str, str]:
    return {d["DistrictID"]: d["DistrictName"] for d in get_districts()}


def unit_by_id() -> Dict[str, Dict]:
    return {
        u["UnitID"]: {"name": u["UnitName"], "districtId": u["DistrictID"]}
        for u in get_units()
    }


def crime_head_by_id() -> Dict[str, str]:
    return {c["CrimeHeadID"]: c["CrimeGroupName"] for c in get_crime_heads()}


def crime_subhead_by_id() -> Dict[str, str]:
    return {c["CrimeSubHeadID"]: c["CrimeHeadName"] for c in get_crime_subheads()}


def status_by_id() -> Dict[str, str]:
    return {s["CaseStatusID"]: s["CaseStatusName"] for s in get_case_statuses()}


# ── Date helpers ──────────────────────────────────────────────────────────────

def parse_date(s: str) -> Optional[datetime]:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None


def _cutoff(days: int) -> str:
    return (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")


# ── Case queries ──────────────────────────────────────────────────────────────

def get_cases(days: int = 365, district_id: Optional[int] = None) -> List[Dict]:
    cutoff = _cutoff(days)
    base = (
        "SELECT Casemasterid, CrimeRegisteredDate, PoliceStationID, "
        "CrimeMajorHeadID, CrimeMinorHeadID, CaseStatusID, "
        "IncidentFromDate, latitude, longitude "
        f"FROM CaseMaster WHERE CrimeRegisteredDate >= '{cutoff}'"
    )
    if district_id:
        station_ids = [
            u["UnitID"] for u in get_units()
            if str(u.get("DistrictID", "")) == str(district_id)
        ]
        if not station_ids:
            return []
        ids = ",".join(f"'{s}'" for s in station_ids)
        base += f" AND PoliceStationID IN ({ids})"
    return _q(base)


def get_accused(case_ids: List[str]) -> List[Dict]:
    if not case_ids:
        return []
    ids = ",".join(f"'{c}'" for c in case_ids[:500])
    return _q(
        f"SELECT AccusedMasterID, CaseMasterID, AccusedName, AgeYear, GenderID, PersonID "
        f"FROM Accused WHERE CaseMasterID IN ({ids})"
    )


def get_victims(case_ids: List[str]) -> List[Dict]:
    if not case_ids:
        return []
    ids = ",".join(f"'{c}'" for c in case_ids[:500])
    return _q(
        f"SELECT VictimMasterID, CaseMasterID, VictimName, AgeYear, GenderID "
        f"FROM Victim WHERE CaseMasterID IN ({ids})"
    )
