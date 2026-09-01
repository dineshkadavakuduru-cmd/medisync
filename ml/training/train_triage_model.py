import json
import os
import random
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

BASE_DIR = Path(__file__).parent
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)

SYMPTOMS = [
    "chest_pain", "unconscious", "severe_bleeding", "difficulty_breathing",
    "seizures", "stroke_symptoms", "severe_burns", "poisoning", "snakebite",
    "severe_allergic_reaction", "high_fever", "persistent_vomiting",
    "severe_abdominal_pain", "dehydration", "high_blood_pressure",
    "severe_headache", "bloody_stool", "pregnancy_complication",
    "chest_tightness", "confusion", "mild_fever", "headache", "cough",
    "cold", "body_ache", "fatigue", "sore_throat", "mild_diarrhea",
    "skin_rash", "joint_pain", "nausea", "dizziness", "eye_irritation",
    "ear_pain", "toothache", "back_pain", "weight_loss", "loss_of_appetite",
]

SEVERITY_MAP = {"GREEN": 0, "YELLOW": 1, "RED": 2}

RED_SYMPTOMS = {"chest_pain", "unconscious", "severe_bleeding", "difficulty_breathing",
                "seizures", "stroke_symptoms", "severe_burns", "poisoning", "snakebite",
                "severe_allergic_reaction", "pregnancy_complication"}

YELLOW_SYMPTOMS = {"high_fever", "persistent_vomiting", "severe_abdominal_pain",
                   "dehydration", "high_blood_pressure", "severe_headache",
                   "bloody_stool", "chest_tightness", "confusion"}


def determine_severity(symptoms, age, temperature, heart_rate, spo2):
    if any(s in RED_SYMPTOMS for s in symptoms):
        return "RED"
    if any(s in YELLOW_SYMPTOMS for s in symptoms):
        return "YELLOW"
    if age < 1 or age > 70:
        if any(s in {"mild_fever", "cough", "cold", "body_ache"} for s in symptoms):
            return "YELLOW"
    if temperature and temperature >= 39:
        return "YELLOW"
    if heart_rate and (heart_rate > 120 or heart_rate < 50):
        return "YELLOW"
    if spo2 and spo2 < 94:
        return "YELLOW"
    return "GREEN"


def generate_dataset(n_samples=12000):
    records = []
    for _ in range(n_samples):
        n_symptoms = random.randint(1, 5)
        symptoms = random.sample(SYMPTOMS, n_symptoms)
        age = random.randint(0, 95)
        temperature = round(random.uniform(36.0, 40.5), 1) if random.random() > 0.3 else None
        heart_rate = random.randint(40, 150) if random.random() > 0.3 else None
        spo2 = random.randint(85, 100) if random.random() > 0.3 else None

        severity = determine_severity(symptoms, age, temperature, heart_rate, spo2)

        record = {f"symptom_{s}": (1 if s in symptoms else 0) for s in SYMPTOMS}
        record["age"] = age
        record["temperature"] = temperature if temperature is not None else 37.0
        record["heart_rate"] = heart_rate if heart_rate is not None else 75
        record["spo2"] = spo2 if spo2 is not None else 98
        record["severity"] = severity
        records.append(record)

    return pd.DataFrame(records)


def main():
    print("Generating synthetic triage dataset...")
    df = generate_dataset(12000)

    feature_cols = [f"symptom_{s}" for s in SYMPTOMS] + ["age", "temperature", "heart_rate", "spo2"]
    X = df[feature_cols].values
    y = df["severity"].map(SEVERITY_MAP).values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print("Training GradientBoosting triage model...")
    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    print(f"Train accuracy: {train_score:.4f}")
    print(f"Test accuracy: {test_score:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, model.predict(X_test), target_names=["GREEN", "YELLOW", "RED"]))

    model_path = MODEL_DIR / "triage_model.pkl"
    joblib.dump(model, model_path)
    print(f"\nModel saved to {model_path}")

    vocab = {
        "symptoms": SYMPTOMS,
        "feature_cols": feature_cols,
        "severity_map": SEVERITY_MAP,
        "reverse_severity_map": {v: k for k, v in SEVERITY_MAP.items()},
    }
    vocab_path = MODEL_DIR / "symptom_vocab.json"
    with open(vocab_path, "w") as f:
        json.dump(vocab, f, indent=2)
    print(f"Vocabulary saved to {vocab_path}")


if __name__ == "__main__":
    main()
