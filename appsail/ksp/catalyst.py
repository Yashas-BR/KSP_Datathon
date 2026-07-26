"""Catalyst Datastore helpers (used when running on Catalyst AppSail)."""
from __future__ import annotations
from typing import Dict


def _project_columns(row: Dict, columns: str) -> Dict:
    """Case-insensitive column projection."""
    wanted = [c.strip() for c in columns.split(",")]
    lower_row = {k.lower(): (k, v) for k, v in row.items()}
    result = {}
    for col in wanted:
        match = lower_row.get(col.lower())
        if match:
            result[col] = match[1]
    return result
