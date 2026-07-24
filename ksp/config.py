from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class AppConfig:
    quickml_llm_url: str | None
    quickml_risk_url: str | None
    quickml_anomaly_url: str | None
    quickml_api_key: str | None
    request_timeout_seconds: float


def load_config() -> AppConfig:
    return AppConfig(
        quickml_llm_url=os.environ.get("QUICKML_LLM_URL"),
        quickml_risk_url=os.environ.get("QUICKML_RISK_URL"),
        quickml_anomaly_url=os.environ.get("QUICKML_ANOMALY_URL"),
        quickml_api_key=os.environ.get("QUICKML_API_KEY"),
        request_timeout_seconds=float(os.environ.get("KSP_REQUEST_TIMEOUT", "30")),
    )