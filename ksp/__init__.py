"""
KSP Crime Analytics Platform - Backend Package
Karnataka State Police - Crime Intelligence & Analytical Platform
"""

__version__ = "1.0.0"
__author__ = "Karnataka State Police"

from ksp.analytics import (
    build_dashboard_payload,
    build_network_payload,
    build_occupation_correlation_payload,
    build_station_lookup_payload,
    build_trend_alert_payload,
)
from ksp.quickml import (
    build_nlq_payload,
    build_quickml_anomaly_payload,
    build_quickml_risk_payload,
)

__all__ = [
    "build_dashboard_payload",
    "build_network_payload", 
    "build_occupation_correlation_payload",
    "build_station_lookup_payload",
    "build_trend_alert_payload",
    "build_nlq_payload",
    "build_quickml_anomaly_payload",
    "build_quickml_risk_payload",
]