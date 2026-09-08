"""Train an experimental LSTM on seeded, hourly, 90-day synthetic occupancy."""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.bed_model import HORIZONS, MODEL_CONTRACT, SEQUENCE_LENGTH, build_model

MODEL_DIR = Path(__file__).resolve().parents[1] / "models"


def generate_synthetic_data(seed=42):
    rng = np.random.default_rng(seed)
    hours = np.arange(90 * 24)
    noise = rng.normal(0, 0.015, len(hours))
    for index in range(1, len(noise)):
        noise[index] += 0.8 * noise[index - 1]
    occupancy = (
        0.65 + 0.10 * np.sin(2 * np.pi * hours / 24)
        + 0.08 * np.sin(2 * np.pi * hours / (7 * 24))
        + 0.04 * np.sin(2 * np.pi * hours / (30 * 24)) + noise
    )
    return np.clip(occupancy, 0, 1).astype(np.float32)


def make_windows(series):
    origins = np.arange(SEQUENCE_LENGTH - 1, len(series) - max(HORIZONS))
    inputs = np.stack([series[index - SEQUENCE_LENGTH + 1:index + 1] for index in origins])
    targets = np.stack([series[index + np.array(HORIZONS)] for index in origins])
    return inputs[:, :, None], targets, origins


def train(output_dir=MODEL_DIR, seed=42, epochs=20):
    if epochs < 1 or seed < 0 or seed > 2**32 - 1:
        raise ValueError("epochs must be positive and seed must be an unsigned 32-bit integer")
    try:
        import torch
    except ImportError as exc:
        raise RuntimeError(
            "Training requires optional PyTorch: install torch separately. The API does not require it."
        ) from exc

    torch.manual_seed(seed)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    series = generate_synthetic_data(seed)
    inputs, targets, origins = make_windows(series)
    split_hour = 72 * 24
    # Purge crossing targets: no training target reaches the validation period.
    training = origins + max(HORIZONS) < split_hour
    validation = origins >= split_hour
    x_train, y_train = torch.from_numpy(inputs[training]), torch.from_numpy(targets[training])
    x_valid, y_valid = torch.from_numpy(inputs[validation]), torch.from_numpy(targets[validation])
    model = build_model()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.005)
    loss_fn = torch.nn.MSELoss()
    model.train()
    for _ in range(epochs):
        for batch in torch.randperm(len(x_train)).split(64):
            optimizer.zero_grad()
            loss = loss_fn(model(x_train[batch]), y_train[batch])
            loss.backward()
            optimizer.step()
    model.eval()
    with torch.inference_mode():
        errors = (model(x_valid) - y_valid).abs().mean(dim=0).tolist()

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), output_dir / "bed_model.pt")
    metadata = {
        **MODEL_CONTRACT,
        "seed": seed,
        "epochs": epochs,
        "optimizer": "Adam",
        "learning_rate": 0.005,
        "batch_size": 64,
        "loss": "MSELoss",
        "device": "cpu",
        "deterministic_algorithms": True,
        "synthetic_days": 90,
        "sample_interval_hours": 1,
        "sample_count": len(series),
        "synthetic_start_utc": "2025-01-01T00:00:00Z",
        "generator_version": 1,
        "data_sha256": hashlib.sha256(series.astype("<f4").tobytes()).hexdigest(),
        "training_samples": int(training.sum()),
        "validation_samples": int(validation.sum()),
        "validation_start_hour": split_hour,
        "validation_mae_occupancy_rate": dict(zip(map(str, HORIZONS), errors)),
        "torch_version": str(torch.__version__),
        "numpy_version": np.__version__,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "limitations": "Synthetic data only; not clinically validated or facility calibrated.",
    }
    (output_dir / "bed_model_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--output-dir", type=Path, default=MODEL_DIR)
    args = parser.parse_args()
    try:
        metadata = train(args.output_dir, args.seed, args.epochs)
    except (RuntimeError, ValueError) as exc:
        parser.exit(1, f"{exc}\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
