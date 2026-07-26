from __future__ import annotations

import os
import re
import logging

from flask import Flask, jsonify, request
from flask_cors import CORS

from ksp.analytics import (
    build_crime_hotspots_payload,
    build_dashboard_payload,
    build_district_map_payload,
    build_network_payload,
    build_occupation_correlation_payload,
    build_socio_predictive_payload,
    build_station_lookup_payload,
    build_trend_alert_payload,
)
from ksp.quickml import (
    build_nlq_payload,
    build_quickml_anomaly_payload,
    build_quickml_risk_payload,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ksp-app")


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, origins=[
        re.compile(r"^https?://localhost(:\d+)?$"),
        re.compile(r"^https?://127\.0\.0\.1(:\d+)?$"),
        re.compile(r"^https://.*\.catalystserverless\.in$"),
        re.compile(r"^https://.*\.catalystappsail\.in$"),
    ])

    @app.after_request
    def log_req(response):
        print(f"[{request.method}] {request.path} {response.status_code}", flush=True)
        return response

    @app.route("/api/debug")
    def debug():
        try:
            from ksp.data import _zcql
            rows = _zcql().execute_query("SELECT Casemasterid, CrimeRegisteredDate, PoliceStationID, CrimeMajorHeadID, CrimeMinorHeadID, CaseStatusID, IncidentFromDate, latitude, longitude FROM CaseMaster LIMIT 3")
            return jsonify({"raw": rows[:3] if rows else [], "count": len(rows) if rows else 0})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/health", methods=["GET", "HEAD"])
    def health():
        return jsonify({"status": "ok"}), 200

    @app.route("/api/meta")
    def meta():
        try:
            return jsonify(build_station_lookup_payload(request))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/dashboard")
    def dashboard():
        try:
            return jsonify(build_dashboard_payload(
                request,
                district_id=request.args.get("district_id", type=int),
                days=request.args.get("days", default=365, type=int),
                hour=request.args.get("hour", type=int),
            ))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/trends")
    def trends():
        try:
            return jsonify(build_trend_alert_payload(
                request,
                district_id=request.args.get("district_id", type=int),
                days=request.args.get("days", default=365, type=int),
            ))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/network")
    def network():
        try:
            return jsonify(build_network_payload(
                request,
                district_id=request.args.get("district_id", type=int),
                focus_person_id=request.args.get("focus_person_id"),
                top=request.args.get("top", default=35, type=int),
            ))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/correlations")
    def correlations():
        try:
            return jsonify(build_occupation_correlation_payload(
                request,
                district_id=request.args.get("district_id", type=int),
                days=request.args.get("days", default=365, type=int),
            ))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/lookups/stations/<int:district_id>")
    def stations_for_district(district_id: int):
        try:
            return jsonify(build_station_lookup_payload(request, district_id=district_id))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/district_map")
    def district_map():
        try:
            return jsonify(build_district_map_payload(
                request,
                days=request.args.get("days", default=365, type=int),
            ))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/crime_hotspots")
    def crime_hotspots():
        try:
            return jsonify(build_crime_hotspots_payload(request))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/socio_predictive")
    def socio_predictive():
        try:
            return jsonify(build_socio_predictive_payload(
                request,
                district_id=request.args.get("district_id", type=int),
                days=request.args.get("days", default=180, type=int),
            ))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ml/risk", methods=["POST"])
    def quickml_risk():
        try:
            return jsonify(build_quickml_risk_payload(request, request.get_json(silent=True) or {}))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ml/anomaly", methods=["POST"])
    def quickml_anomaly():
        try:
            return jsonify(build_quickml_anomaly_payload(request, request.get_json(silent=True) or {}))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/nlq", methods=["POST"])
    def nlq():
        try:
            body = request.get_json(silent=True) or {}
            return jsonify(build_nlq_payload(request, body))
        except Exception as e:
            logger.error(e)
            return jsonify({"error": str(e), "question": (request.get_json(silent=True) or {}).get("question", "")}), 500

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", os.environ.get("PORT", 8000)))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
