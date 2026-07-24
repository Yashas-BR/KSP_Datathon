from __future__ import annotations

import os
import logging
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

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

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"


def create_app() -> Flask:
    app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="/assets")
    
    # CORS - Configured ONLY ONCE
    CORS(app, origins=[
        "https://ksp-demo-60076799070.development.catalystserverless.in",
        "https://*.catalystserverless.in",
        "https://*.catalystappsail.in"
    ])

    @app.before_request
    def fix_catalyst_routing_prefix():
        # Normalize paths for Catalyst
        if request.path.startswith("/api/") or request.path == "/health":
            return None
        parts = request.path.strip("/").split("/")
        if "api" in parts:
            api_index = parts.index("api")
            normalized_path = "/" + "/".join(parts[api_index:])
            request.environ["PATH_INFO"] = normalized_path

    @app.route("/health", methods=["GET", "HEAD"])
    def health():
        return jsonify({"status": "ok", "service": "ksp-analytics-platform"}), 200

    @app.route("/")
    def index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/favicon.ico")
    def favicon():
        return "", 204

    @app.route("/api/meta")
    def meta():
        try:
            return jsonify(build_station_lookup_payload(request))
        except Exception as e:
            logger.error(f"Meta endpoint error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/dashboard")
    def dashboard():
        try:
            district_id = request.args.get("district_id", type=int)
            days = request.args.get("days", default=365, type=int)
            hour = request.args.get("hour", type=int)
            return jsonify(build_dashboard_payload(request, district_id=district_id, days=days, hour=hour))
        except Exception as e:
            logger.error(f"Dashboard endpoint error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/trends")
    def trends():
        try:
            district_id = request.args.get("district_id", type=int)
            days = request.args.get("days", default=365, type=int)
            return jsonify(build_trend_alert_payload(request, district_id=district_id, days=days))
        except Exception as e:
            logger.error(f"Trends endpoint error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/network")
    def network():
        try:
            district_id = request.args.get("district_id", type=int)
            focus_person_id = request.args.get("focus_person_id")
            top = request.args.get("top", default=35, type=int)
            return jsonify(build_network_payload(request, district_id=district_id, focus_person_id=focus_person_id, top=top))
        except Exception as e:
            logger.error(f"Network endpoint error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/correlations")
    def correlations():
        try:
            district_id = request.args.get("district_id", type=int)
            days = request.args.get("days", default=365, type=int)
            return jsonify(build_occupation_correlation_payload(request, district_id=district_id, days=days))
        except Exception as e:
            logger.error(f"Correlations endpoint error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/lookups/stations/<int:district_id>")
    def stations_for_district(district_id: int):
        try:
            return jsonify(build_station_lookup_payload(request, district_id=district_id))
        except Exception as e:
            logger.error(f"Stations endpoint error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ml/risk", methods=["POST"])
    def quickml_risk():
        try:
            body = request.get_json(silent=True) or {}
            return jsonify(build_quickml_risk_payload(request, body))
        except Exception as e:
            logger.error(f"ML Risk endpoint error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ml/anomaly", methods=["POST"])
    def quickml_anomaly():
        try:
            body = request.get_json(silent=True) or {}
            return jsonify(build_quickml_anomaly_payload(request, body))
        except Exception as e:
            logger.error(f"ML Anomaly endpoint error: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/nlq", methods=["POST"])
    def nlq():
        try:
            body = request.get_json(silent=True) or {}
            return jsonify(build_nlq_payload(request, body))
        except Exception as e:
            logger.error(f"NLQ endpoint error: {e}")
            return jsonify({"error": str(e), "question": body.get("question", "")}), 500

    @app.route("/assets/<path:filename>")
    def assets(filename: str):
        return send_from_directory(FRONTEND_DIR, filename)

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", 
               os.environ.get("PORT", 8000)))
    app.run(host="0.0.0.0", port=port, debug=False)