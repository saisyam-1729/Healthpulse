"""Flask blueprint for the diffusion endpoints.

Mounted into the EXISTING ai_service/app.py (see docs/MODEL_SELECTION.md
section 5 — deliberately not a second microservice). Endpoints only exist
for the tasks actually selected in MODEL_SELECTION.md: /impute (primary),
/forecast and /generate (secondary), /anomaly-score (secondary, derived).

Request/response schema, validation, and error handling are documented
inline on each route.
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from diffusion.data.synthetic import CHANNEL_ORDER
from diffusion.inference.service import ModelNotLoadedError, get_service

diffusion_bp = Blueprint("diffusion", __name__, url_prefix="/api/diffusion")

MAX_READINGS = 500
MAX_GENERATE_LENGTH = 200
MAX_PREDICTION_LENGTH = 60


def _validate_readings(readings) -> tuple[bool, str]:
    if not isinstance(readings, list) or len(readings) == 0:
        return False, "'readings' must be a non-empty array"
    if len(readings) > MAX_READINGS:
        return False, f"'readings' exceeds max length {MAX_READINGS}"
    for i, r in enumerate(readings):
        if not isinstance(r, dict):
            return False, f"readings[{i}] must be an object"
        for ch in CHANNEL_ORDER:
            if ch in r and r[ch] is not None:
                try:
                    float(r[ch])
                except (TypeError, ValueError):
                    return False, f"readings[{i}].{ch} must be numeric or null"
    return True, ""


def _array_to_readings(arr, channels=CHANNEL_ORDER) -> list[dict]:
    return [{ch: float(row[c]) for c, ch in enumerate(channels)} for row in arr]


@diffusion_bp.route("/impute", methods=["POST"])
def impute():
    """Request: {"readings": [{"heartRate": x|null, "spo2": x|null, "temperature": x|null}, ...], "numSamples": int?}
    Response: {"imputed": [...], "lower": [...], "upper": [...], "channels": [...]}
    Missing/null fields in a reading are treated as unobserved and filled in.
    Observed fields are always echoed back unchanged.
    """
    body = request.get_json(silent=True) or {}
    readings = body.get("readings")
    ok, err = _validate_readings(readings)
    if not ok:
        return jsonify({"error": err}), 400

    service = get_service()
    try:
        result = service.impute(readings, num_samples=body.get("numSamples"))
    except ModelNotLoadedError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"inference failed: {exc}"}), 500

    return jsonify(
        {
            "imputed": _array_to_readings(result["mean"], result["channels"]),
            "lower": _array_to_readings(result["lower"], result["channels"]),
            "upper": _array_to_readings(result["upper"], result["channels"]),
            "channels": result["channels"],
            "validity": result["validity"],
        }
    )


@diffusion_bp.route("/forecast", methods=["POST"])
def forecast():
    """Request: {"readings": [...], "predictionLength": int, "numSamples": int?}
    Response: {"forecast": [...], "lower": [...], "upper": [...], "channels": [...]}
    `readings` is the observed CONTEXT window; the response covers only the
    future `predictionLength` steps (not the echoed context).
    """
    body = request.get_json(silent=True) or {}
    readings = body.get("readings")
    ok, err = _validate_readings(readings)
    if not ok:
        return jsonify({"error": err}), 400

    prediction_length = body.get("predictionLength")
    if not isinstance(prediction_length, int) or not (0 < prediction_length <= MAX_PREDICTION_LENGTH):
        return jsonify({"error": f"'predictionLength' must be an int in (0, {MAX_PREDICTION_LENGTH}]"}), 400

    service = get_service()
    try:
        result = service.forecast(readings, prediction_length, num_samples=body.get("numSamples"))
    except ModelNotLoadedError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"inference failed: {exc}"}), 500

    return jsonify(
        {
            "forecast": _array_to_readings(result["mean"], result["channels"]),
            "lower": _array_to_readings(result["lower"], result["channels"]),
            "upper": _array_to_readings(result["upper"], result["channels"]),
            "channels": result["channels"],
            "validity": result["validity"],
        }
    )


@diffusion_bp.route("/generate", methods=["POST"])
def generate():
    """Request: {"length": int, "numSamples": int?}
    Response: {"synthetic": true, "sequence": [...], "channels": [...]}
    Every value here is model-generated, not a real measurement. The
    'synthetic': true flag MUST be surfaced by the frontend as a visible
    label, never displayed as though it were a real reading.
    """
    body = request.get_json(silent=True) or {}
    length = body.get("length")
    if not isinstance(length, int) or not (0 < length <= MAX_GENERATE_LENGTH):
        return jsonify({"error": f"'length' must be an int in (0, {MAX_GENERATE_LENGTH}]"}), 400

    service = get_service()
    try:
        result = service.generate(length, num_samples=body.get("numSamples"))
    except ModelNotLoadedError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"inference failed: {exc}"}), 500

    return jsonify(
        {
            "synthetic": True,
            "sequence": _array_to_readings(result["mean"], result["channels"]),
            "channels": result["channels"],
            "validity": result["validity"],
        }
    )


@diffusion_bp.route("/anomaly-score", methods=["POST"])
def anomaly_score():
    """Request: {"readings": [...], "numSamples": int?}
    Response: {"anomalyScore": float, "perPointError": [...], "channels": [...]}
    This is a supplementary signal for the EXISTING alert pipeline
    (backend ruleEngine.js/healthEngine.js), not a replacement diagnosis.
    """
    body = request.get_json(silent=True) or {}
    readings = body.get("readings")
    ok, err = _validate_readings(readings)
    if not ok:
        return jsonify({"error": err}), 400

    service = get_service()
    try:
        result = service.anomaly_score(readings, num_samples=body.get("numSamples"))
    except ModelNotLoadedError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"inference failed: {exc}"}), 500

    return jsonify(
        {
            "anomalyScore": result["anomaly_score"],
            "perPointError": _array_to_readings(result["reconstruction_error"], result["channels"]),
            "channels": result["channels"],
        }
    )


@diffusion_bp.route("/health", methods=["GET"])
def health():
    service = get_service()
    return jsonify({"modelLoaded": service.is_loaded})
