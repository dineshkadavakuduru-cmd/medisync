"""Experimental occupancy forecasts; not a clinical or allocation tool."""

import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

import numpy as np
from fastapi import APIRouter
from pydantic import (
    AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator,
)

from api.bed_model import HORIZONS, MODEL_CONTRACT, SEQUENCE_LENGTH, build_model

router = APIRouter()
MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
DISCLAIMER = (
    "Synthetic/demo forecasting method, not clinically validated. "
    "Do not use for clinical decisions or automatic bed allocation."
)


class BedObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: AwareDatetime
    occupied_beds: int = Field(strict=True, ge=0)


class BedPredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    facility_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
    capacity: int = Field(strict=True, ge=1, le=1_000_000)
    history: list[BedObservation] = Field(min_length=2, max_length=2160)

    @model_validator(mode="after")
    def validate_history(self):
        previous = None
        for observation in self.history:
            if observation.occupied_beds > self.capacity:
                raise ValueError("occupied_beds must not exceed capacity")
            try:
                timestamp = observation.timestamp.astimezone(timezone.utc)
            except OverflowError as exc:
                raise ValueError("history timestamp is outside the supported UTC range") from exc
            if previous is not None and timestamp - previous != timedelta(hours=1):
                raise ValueError("history must be oldest-first with exactly hourly observations")
            previous = timestamp
        try:
            previous + timedelta(hours=max(HORIZONS))
        except OverflowError as exc:
            raise ValueError("last history timestamp is too large to forecast") from exc
        return self


class BedForecast(BaseModel):
    horizon_hours: Literal[6, 12, 24, 48]
    timestamp: datetime
    occupied_beds: int = Field(ge=0)
    available_beds: int = Field(ge=0)
    occupancy_rate: float = Field(ge=0, le=1)


class BedPredictionResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    facility_id: str
    capacity: int
    model_used: Literal["synthetic_lstm", "synthetic_moving_average_trend_fallback"]
    fallback_reason: Literal["insufficient_history", "model_not_found", "model_unavailable"] | None
    synthetic: Literal[True] = True
    clinically_validated: Literal[False] = False
    disclaimer: str = DISCLAIMER
    forecasts: list[BedForecast]


@lru_cache(maxsize=1)
def load_bed_model():
    # Only trusted, locally trained artifacts are loaded; never accept upload paths.
    metadata = json.loads((MODEL_DIR / "bed_model_metadata.json").read_text(encoding="utf-8"))
    if any(metadata.get(key) != value for key, value in MODEL_CONTRACT.items()):
        raise ValueError("Incompatible bed model metadata")
    import torch

    model = build_model()
    model.load_state_dict(torch.load(MODEL_DIR / "bed_model.pt", map_location="cpu", weights_only=True))
    model.eval()
    return model


def forecast_occupancy(request):
    values = np.array([point.occupied_beds for point in request.history[-SEQUENCE_LENGTH:]], dtype=float)
    if len(values) < SEQUENCE_LENGTH:
        reason = "insufficient_history"
    elif not all((MODEL_DIR / name).is_file() for name in ("bed_model.pt", "bed_model_metadata.json")):
        reason = "model_not_found"
    else:
        try:
            model = load_bed_model()
            import torch

            inputs = torch.tensor(values / request.capacity, dtype=torch.float32).reshape(1, -1, 1)
            with torch.inference_mode():
                predictions = model(inputs).cpu().numpy().reshape(-1)
            if predictions.shape != (len(HORIZONS),) or not np.isfinite(predictions).all():
                raise ValueError("Invalid model predictions")
            return np.clip(predictions, 0, 1) * request.capacity, "synthetic_lstm", None
        except Exception:
            # Missing optional dependencies or corrupt artifacts must not break the API.
            reason = "model_unavailable"

    # Fit a trend around the recent moving average, then extrapolate from the last hour.
    times = np.arange(len(values), dtype=float)
    centered = times - times.mean()
    slope = float(np.dot(centered, values - values.mean()) / np.dot(centered, centered))
    predictions = values.mean() + slope * (np.array(HORIZONS) + times[-1] - times.mean())
    return np.clip(predictions, 0, request.capacity), "synthetic_moving_average_trend_fallback", reason


@router.post("/predict/beds", response_model=BedPredictionResponse)
def predict_beds(request: BedPredictionRequest):
    predictions, method, reason = forecast_occupancy(request)
    origin = request.history[-1].timestamp.astimezone(timezone.utc)
    forecasts = []
    for horizon, prediction in zip(HORIZONS, predictions):
        occupied = min(request.capacity, max(0, int(round(float(prediction)))))
        forecasts.append(BedForecast(
            horizon_hours=horizon,
            timestamp=origin + timedelta(hours=horizon),
            occupied_beds=occupied,
            available_beds=request.capacity - occupied,
            occupancy_rate=occupied / request.capacity,
        ))
    return BedPredictionResponse(
        facility_id=request.facility_id,
        capacity=request.capacity,
        model_used=method,
        fallback_reason=reason,
        forecasts=forecasts,
    )
