# Experimental Bed Forecasts

Run from `ml/`: `uvicorn api.main:app --port 8000`. Existing `/triage` and
`/health` behavior is unchanged. PyTorch is not required to import or run the API.

`POST /predict/beds` accepts:

```json
{
  "facility_id": "demo-phc-01",
  "capacity": 100,
  "history": [
    {"timestamp": "2026-09-08T00:00:00Z", "occupied_beds": 60},
    {"timestamp": "2026-09-08T01:00:00Z", "occupied_beds": 62}
  ]
}
```

Facility IDs must be nonblank strings of at most 128 characters. Capacity must
be an integer from 1 to 1,000,000. History requires 2 to 2160 oldest-first,
exactly hourly, timezone-aware observations with integer occupancy between zero
and capacity. Unknown fields are rejected. All history must describe the same
facility and capacity; facility IDs are labels, not authenticated registry lookups.

Returns forecasts 6, 12, 24 and 48 hours after the final observation (not wall-clock
time), with occupied beds, available beds and occupancy rate. Counts are rounded
and clamped to capacity; availability is capacity minus occupancy. No inputs are
persisted. No confidence or clinical accuracy claims are made.

The fallback uses the last 24 observations (or all available observations), fits
a least-squares hourly trend around their moving average, and extrapolates it.
`model_used`, `fallback_reason`, `synthetic: true`, `clinically_validated: false`
and a disclaimer identify the method and limitations on every response. The
synthetic label describes this demo method/model, not the provenance of submitted
history. Sparse history, missing weights, missing PyTorch or invalid model
artifacts trigger fallback. A successfully loaded model is cached; restart the
API after replacing artifacts.

## Optional Training

Install a suitable CPU PyTorch build separately if training or LSTM inference is
needed. It is intentionally absent from API and test requirements.

```powershell
python training/train_bed_model.py --seed 42 --epochs 20
```

Training creates `ml/models/bed_model.pt` (state dictionary only) and
`ml/models/bed_model_metadata.json`. The LSTM uses 24 hourly occupancy fractions
to predict all four horizons with sigmoid-bounded outputs. A seeded generator
creates 90 days of hourly daily/weekly/monthly cycles and correlated noise.
Training targets stay within the first 72 days; validation origins are in the
remaining 18 days. Windows crossing the target split are excluded from training.
Metadata records the model contract, seed, data hash, library versions, split,
training settings and synthetic validation MAE. Reproducibility is expected on
the same CPU/library versions, not across all hardware or releases.

Only load trusted locally generated artifacts. Neither this LSTM nor the
fallback has clinical validation, real-demand evaluation or facility-specific
calibration. Fixed capacity and regular hourly sampling are assumed. Abrupt
surges and reporting changes are not modeled. Do not use for clinical decisions
or automatic bed allocation.

## Tests

```powershell
python -m pip install -r requirements-test.txt
python -m pytest --basetemp=.pytest-temp
```

LSTM training/round-trip tests skip when PyTorch is absent; API, validation,
fallback, synthetic-data and triage regression tests run without it.
