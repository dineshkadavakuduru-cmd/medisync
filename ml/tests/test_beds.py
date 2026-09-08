import builtins
import json
import subprocess
import sys
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import numpy as np
import pytest
from fastapi.testclient import TestClient

from api import beds, main
from api.bed_model import HORIZONS, MODEL_CONTRACT
from training.train_bed_model import generate_synthetic_data, make_windows, train


def payload(values=(50, 50), capacity=100):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        "facility_id": " demo-phc-01 ",
        "capacity": capacity,
        "history": [
            {"timestamp": (start + timedelta(hours=index)).isoformat(), "occupied_beds": value}
            for index, value in enumerate(values)
        ],
    }


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(beds, "MODEL_DIR", tmp_path)
    loader = beds.load_bed_model
    loader.cache_clear()
    with TestClient(main.app) as test_client:
        yield test_client
    loader.cache_clear()


@pytest.mark.parametrize("values,expected", [
    ([50, 50], [50] * 4),
    ([40, 41], [47, 53, 65, 89]),
    ([60, 59], [53, 47, 35, 11]),
    ([0, 100], [100] * 4),
    ([100, 0], [0] * 4),
    ([0, 0], [0] * 4),
    ([100, 100], [100] * 4),
])
def test_fallback_forecasts(client, values, expected):
    response = client.post("/predict/beds", json=payload(values))
    assert response.status_code == 200
    result = response.json()
    assert result["facility_id"] == "demo-phc-01"
    assert result["synthetic"] is True
    assert result["clinically_validated"] is False
    assert "not clinically validated" in result["disclaimer"]
    assert result["model_used"] == "synthetic_moving_average_trend_fallback"
    assert result["fallback_reason"] == "insufficient_history"
    assert [point["horizon_hours"] for point in result["forecasts"]] == list(HORIZONS)
    assert [point["occupied_beds"] for point in result["forecasts"]] == expected
    origin = datetime(2026, 1, 1, 1, tzinfo=timezone.utc)
    for point in result["forecasts"]:
        assert datetime.fromisoformat(point["timestamp"]) == origin + timedelta(hours=point["horizon_hours"])
        assert point["available_beds"] + point["occupied_beds"] == 100
        assert point["occupancy_rate"] == point["occupied_beds"] / 100


@pytest.mark.parametrize("field,value", [
    ("facility_id", ""), ("facility_id", " \t "), ("facility_id", "a" * 129),
    ("facility_id", 123), ("facility_id", None),
    ("capacity", 0), ("capacity", -1), ("capacity", 1_000_001),
    ("capacity", True), ("capacity", 1.5), ("capacity", "100"),
    ("history", []), ("history", payload()["history"][:1]),
    ("history", payload([50] * 2161)["history"]), ("unknown", 1),
])
def test_invalid_request_fields(client, field, value):
    data = payload()
    data[field] = value
    assert client.post("/predict/beds", json=data).status_code == 422


@pytest.mark.parametrize("field", ["facility_id", "capacity", "history"])
def test_missing_required_fields(client, field):
    data = payload()
    del data[field]
    assert client.post("/predict/beds", json=data).status_code == 422


@pytest.mark.parametrize("value", [-1, 101, True, 50.5, "50", None])
def test_invalid_occupancy(client, value):
    data = payload()
    data["history"][0]["occupied_beds"] = value
    assert client.post("/predict/beds", json=data).status_code == 422


@pytest.mark.parametrize("timestamp", [
    "2026-01-01T01:00:00", "invalid", "2026-01-01T00:00:00Z",
    "2025-12-31T23:00:00Z", "2026-01-01T02:00:00Z", "2026-01-01T01:30:00Z",
])
def test_invalid_history_timestamps(client, timestamp):
    data = payload()
    data["history"][1]["timestamp"] = timestamp
    assert client.post("/predict/beds", json=data).status_code == 422


def test_forecast_timestamp_overflow(client):
    data = payload()
    data["history"][0]["timestamp"] = "9999-12-31T22:00:00Z"
    data["history"][1]["timestamp"] = "9999-12-31T23:00:00Z"
    assert client.post("/predict/beds", json=data).status_code == 422


def test_utc_conversion_overflow(client):
    data = payload()
    data["history"][0]["timestamp"] = "0001-01-01T00:00:00+01:00"
    assert client.post("/predict/beds", json=data).status_code == 422


def test_timezone_offsets_and_extra_observation_fields(client):
    data = payload()
    data["history"][1]["timestamp"] = "2026-01-01T06:30:00+05:30"
    assert client.post("/predict/beds", json=data).status_code == 200
    data["history"][0]["unexpected"] = 1
    assert client.post("/predict/beds", json=data).status_code == 422


def test_maximum_history_and_capacity(client):
    result = client.post("/predict/beds", json=payload([1_000_000] * 2160, 1_000_000))
    assert result.status_code == 200
    assert all(point["occupied_beds"] == 1_000_000 for point in result.json()["forecasts"])


def test_fallback_uses_only_recent_24_hours(client):
    result = client.post("/predict/beds", json=payload([0] * 24 + [50] * 24)).json()
    assert result["fallback_reason"] == "model_not_found"
    assert all(point["occupied_beds"] == 50 for point in result["forecasts"])


@pytest.mark.parametrize("artifact_state", ["missing_torch", "bad_json", "wrong_contract", "bad_weights"])
def test_unavailable_artifacts_fall_back(client, monkeypatch, artifact_state):
    metadata = dict(MODEL_CONTRACT)
    if artifact_state == "wrong_contract":
        metadata["sequence_length"] = 99
    (beds.MODEL_DIR / "bed_model_metadata.json").write_text(
        "{" if artifact_state == "bad_json" else json.dumps(metadata), encoding="utf-8",
    )
    (beds.MODEL_DIR / "bed_model.pt").write_bytes(b"not valid weights")
    original_import = builtins.__import__

    def no_torch(name, *args, **kwargs):
        if name == "torch":
            raise ImportError("torch intentionally unavailable")
        return original_import(name, *args, **kwargs)

    if artifact_state == "missing_torch":
        monkeypatch.setattr(builtins, "__import__", no_torch)
    result = client.post("/predict/beds", json=payload([50] * 24))
    assert result.status_code == 200
    assert result.json()["fallback_reason"] == "model_unavailable"


@pytest.mark.parametrize("predictions,expected_reason", [
    ([-0.1, 0.25, 0.75, 1.1], None),
    ([float("nan")] * 4, "model_unavailable"),
    ([float("inf")] * 4, "model_unavailable"),
    ([0.5] * 3, "model_unavailable"),
])
def test_inference_bounds_and_invalid_outputs(client, monkeypatch, predictions, expected_reason):
    for name in ("bed_model.pt", "bed_model_metadata.json"):
        (beds.MODEL_DIR / name).touch()
    fake_torch = SimpleNamespace(
        tensor=lambda values, dtype: np.asarray(values, dtype=dtype),
        float32=np.float32,
        inference_mode=nullcontext,
    )

    def fake_model(inputs):
        assert inputs.shape == (1, 24, 1)
        assert np.all(inputs == 0.5)
        return SimpleNamespace(cpu=lambda: SimpleNamespace(numpy=lambda: np.asarray(predictions)))

    monkeypatch.setitem(sys.modules, "torch", fake_torch)
    monkeypatch.setattr(beds, "load_bed_model", lambda: fake_model)
    result = client.post("/predict/beds", json=payload([50] * 24)).json()
    assert result["fallback_reason"] == expected_reason
    if expected_reason is None:
        assert result["model_used"] == "synthetic_lstm"
        assert [point["occupied_beds"] for point in result["forecasts"]] == [0, 25, 75, 100]
    else:
        assert result["model_used"] == "synthetic_moving_average_trend_fallback"


def test_api_import_does_not_import_torch():
    script = """
import builtins
original = builtins.__import__
def guarded(name, *args, **kwargs):
    if name == 'torch' or name.startswith('torch.'):
        raise AssertionError('API imported optional torch')
    return original(name, *args, **kwargs)
builtins.__import__ = guarded
from api.main import app
assert any(route.path == '/predict/beds' for route in app.routes)
"""
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_synthetic_data_and_temporal_split():
    series = generate_synthetic_data()
    assert series.shape == (90 * 24,)
    assert np.all((series >= 0) & (series <= 1))
    np.testing.assert_array_equal(series, generate_synthetic_data())
    assert not np.array_equal(series, generate_synthetic_data(seed=43))
    inputs, targets, origins = make_windows(series)
    assert inputs.shape == (2089, 24, 1)
    assert targets.shape == (2089, 4)
    np.testing.assert_array_equal(inputs[0, :, 0], series[:24])
    np.testing.assert_array_equal(targets[0], series[23 + np.array(HORIZONS)])
    training = origins + max(HORIZONS) < 72 * 24
    validation = origins >= 72 * 24
    assert (origins[training] + max(HORIZONS)).max() < origins[validation].min()


def test_training_explains_optional_dependency(monkeypatch, tmp_path):
    original_import = builtins.__import__

    def no_torch(name, *args, **kwargs):
        if name == "torch":
            raise ImportError("torch intentionally unavailable")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", no_torch)
    with pytest.raises(RuntimeError, match="optional PyTorch"):
        train(tmp_path)
    assert not (tmp_path / "bed_model.pt").exists()


def test_optional_lstm_training_round_trip(client):
    torch = pytest.importorskip("torch")
    first = train(beds.MODEL_DIR, epochs=1)
    first_weights = torch.load(beds.MODEL_DIR / "bed_model.pt", weights_only=True)
    second = train(beds.MODEL_DIR, epochs=1)
    second_weights = torch.load(beds.MODEL_DIR / "bed_model.pt", weights_only=True)
    assert first["data_sha256"] == second["data_sha256"]
    assert first["validation_mae_occupancy_rate"] == second["validation_mae_occupancy_rate"]
    assert all(torch.equal(first_weights[key], second_weights[key]) for key in first_weights)
    metadata = json.loads((beds.MODEL_DIR / "bed_model_metadata.json").read_text(encoding="utf-8"))
    assert metadata["synthetic_days"] == 90
    assert all(metadata[key] == value for key, value in MODEL_CONTRACT.items())
    result = client.post("/predict/beds", json=payload([50] * 24)).json()
    assert result["model_used"] == "synthetic_lstm"
    assert result["fallback_reason"] is None
    assert all(0 <= point["occupied_beds"] <= 100 for point in result["forecasts"])


@pytest.mark.parametrize("symptoms,severity", [
    (["chest pain"], "RED"), (["high fever"], "YELLOW"), (["cough"], "GREEN"),
])
def test_triage_fallback_unchanged(client, monkeypatch, symptoms, severity):
    monkeypatch.setattr(main, "model", None)
    monkeypatch.setattr(main, "vocab", None)
    response = client.post("/triage", json={"symptoms": symptoms, "age": 40, "gender": "other"})
    assert response.status_code == 200
    assert response.json()["severity"] == severity
    assert response.json()["model_used"] == "rule_based_fallback"
    assert set(response.json()) == {
        "severity", "confidence", "recommendation", "needs_referral", "suggested_facility", "model_used",
    }
    assert client.get("/health").json() == {
        "status": "ok", "service": "MediSync ML Triage Service", "model_loaded": False,
    }


def test_triage_trained_path_unchanged(client, monkeypatch):
    monkeypatch.setattr(main, "model", SimpleNamespace(
        predict=lambda features: np.array([2]),
        predict_proba=lambda features: np.array([[0.01, 0.04, 0.95]]),
    ))
    monkeypatch.setattr(main, "vocab", {
        "feature_cols": ["symptom_chest_pain", "age", "temperature", "heart_rate", "spo2"],
        "reverse_severity_map": {"2": "RED"},
    })
    response = client.post("/triage", json={"symptoms": ["chest pain"], "age": 40, "gender": "other"})
    assert response.status_code == 200
    assert response.json()["model_used"] == "ml_gradient_boosting"
    assert response.json()["severity"] == "RED"
    assert response.json()["confidence"] == 0.95
    assert client.get("/health").json()["model_loaded"] is True
