from __future__ import annotations

import csv
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

import zcatalyst_sdk  # Must exist on AppSail


MAX_ZCQL_LIMIT = 300
LOOKUP_CACHE: dict[str, list[dict[str, Any]]] = {}
FACT_CACHE: dict[str, list[dict[str, Any]]] = {}
DATA_ROOT = Path(__file__).resolve().parents[1] / "data_v3"
SELECT_QUERY_PATTERN = re.compile(
    r"^select\s+(?P<columns>.+?)\s+from\s+(?P<table>[A-Za-z_][A-Za-z0-9_]*)"
    r"(?:\s+limit\s+(?P<limit>\d+))(?:\s+offset\s+(?P<offset>\d+))?\s*$",
    re.IGNORECASE,
)


def _ensure_sdk() -> Any:
    if zcatalyst_sdk is None:
        raise RuntimeError(
            "zcatalyst_sdk is unavailable. This app must run inside Catalyst AppSail with the Zoho SDK installed."
        )
    return zcatalyst_sdk


def get_zcql_executor(req: Any) -> Any:
    sdk = _ensure_sdk()
    return sdk.initialize(req=req).zcql()


@lru_cache(maxsize=64)
def _read_local_table(table: str) -> list[dict[str, Any]]:
    csv_path = DATA_ROOT / f"{table}.csv"
    if not csv_path.exists():
        return []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _project_columns(row: dict[str, Any], columns: str) -> dict[str, Any]:
    if columns.strip() == "*":
        return dict(row)
    selected: dict[str, Any] = {}
    for column in [item.strip() for item in columns.split(",") if item.strip()]:
        selected[column] = row.get(column)
    return selected


def _execute_local_zcql(query: str) -> list[dict[str, Any]]:
    match = SELECT_QUERY_PATTERN.match(query.strip().rstrip(";"))
    if not match:
        raise RuntimeError(f"Local ZCQL fallback only supports simple SELECT queries: {query}")

    table = match.group("table")
    columns = match.group("columns")
    limit = int(match.group("limit") or MAX_ZCQL_LIMIT)
    offset = int(match.group("offset") or 0)
    rows = _read_local_table(table)
    page = rows[offset : offset + limit]
    return [_project_columns(row, columns) for row in page]


def _extract_rows(result: Any) -> list[dict[str, Any]]:
    if result is None:
        return []
    if isinstance(result, list):
        rows: list[dict[str, Any]] = []
        for item in result:
            if isinstance(item, dict):
                rows.append(item)
            elif isinstance(item, list):
                rows.append({str(index): value for index, value in enumerate(item)})
        return rows
    if isinstance(result, dict):
        for key in ("data", "rows", "result", "items"):
            value = result.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
        return [result]
    return []


def execute_zcql(req: Any, query: str) -> list[dict[str, Any]]:
    if zcatalyst_sdk is None:
        return _execute_local_zcql(query)

    try:
        executor = get_zcql_executor(req)
        # zcatalyst-sdk>=1.4.0 uses .execute() method
        if hasattr(executor, "execute"):
            result = executor.execute(query)
        elif hasattr(executor, "execute_query"):
            result = executor.execute_query(query)
        elif hasattr(executor, "query"):
            result = executor.query(query)
        else:  # pragma: no cover - defensive fallback.
            raise RuntimeError("Catalyst ZCQL executor does not expose execute, execute_query, or query method.")
        return _extract_rows(result)
    except Exception:
        return _execute_local_zcql(query)


def fetch_all(req: Any, query: str) -> list[dict[str, Any]]:
    query = query.strip().rstrip(";")
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        page_query = f"{query} LIMIT {MAX_ZCQL_LIMIT} OFFSET {offset}"
        page = execute_zcql(req, page_query)
        rows.extend(page)
        if len(page) < MAX_ZCQL_LIMIT:
            break
        offset += MAX_ZCQL_LIMIT
    return rows


def cache_key(table: str, columns: str) -> str:
    return f"{table}:{columns}"


def fetch_table(req: Any, table: str, columns: str = "*") -> list[dict[str, Any]]:
    key = cache_key(table, columns)
    if key not in FACT_CACHE:
        FACT_CACHE[key] = fetch_all(req, f"SELECT {columns} FROM {table}")
    return FACT_CACHE[key]


def fetch_lookup(req: Any, table: str, columns: str = "*") -> list[dict[str, Any]]:
    key = cache_key(table, columns)
    if key not in LOOKUP_CACHE:
        LOOKUP_CACHE[key] = fetch_all(req, f"SELECT {columns} FROM {table}")
    return LOOKUP_CACHE[key]


def index_by_id(rows: Iterable[dict[str, Any]], id_field: str) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for row in rows:
        value = row.get(id_field)
        if value is not None:
            indexed[str(value)] = row
    return indexed


def to_int(value: Any, default: int | None = None) -> int | None:
    if value in (None, ""):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def to_float(value: Any, default: float | None = None) -> float | None:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def as_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value)