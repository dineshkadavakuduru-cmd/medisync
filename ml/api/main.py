import json
import os
from pathlib import Path
from typing import List, Optional

import joblib
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="MediSync ML Triage Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent.parent
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "triage_model.pkl"
VOCAB_PATH = MODEL_DIR / "symptom_vocab.json"

model = None
vocab = None


def load_model():
    global model, vocab
    if MODEL_PATH.exists() and VOCAB_PATH.exists():
        model = joblib.load(MODEL_PATH)
        with open(VOCAB_PATH, "r") as f:
            vocab = json.load(f)
        print(f"Loaded trained triage model from {MODEL_PATH}")
    else:
        print("WARNING: No trained model found. Run ml/training/train_triage_model.py first. Falling back to rule-based triage.")
        model = None
        vocab = None


load_model()


class TriageRequest(BaseModel):
    symptoms: List[str] = Field(..., description="List of patient symptoms")
    age: int = Field(..., ge=0, le=150, description="Patient age in years")
    gender: str = Field(..., description="Patient gender: male/female/other")
    temperature: Optional[float] = Field(None, description="Body temperature in Celsius")
    heart_rate: Optional[int] = Field(None, description="Heart rate in bpm")
    spo2: Optional[int] = Field(None, description="Oxygen saturation percentage")


class TriageResponse(BaseModel):
    severity: str
    confidence: float
    recommendation: str
    needs_referral: bool
    suggested_facility: str
    model_used: str


def rule_based_triage(symptoms, age):
    lower_symptoms = [s.lower() for s in symptoms]
    red_symptoms = ["chest pain", "unconscious", "severe bleeding", "difficulty breathing"]
    yellow_symptoms = ["high fever", "persistent vomiting", "abdominal pain"]

    if any(s in lower_symptoms for s in red_symptoms):
        return "RED", 0.95, "Immediate emergency care required. Transfer to nearest district hospital.", True, "District Hospital"
    elif any(s in lower_symptoms for s in yellow_symptoms):
        return "YELLOW", 0.82, "Priority consultation needed. Visit nearest CHC or higher facility.", True, "CHC"
    elif "fever" in lower_symptoms:
        return "YELLOW", 0.75, "Malaria/Dengue screening recommended. Rest and hydration.", False, "PHC"
    elif any(s in lower_symptoms for s in ["cough", "cold", "headache"]):
        return "GREEN", 0.80, "Respiratory infection likely. Rest and symptomatic treatment.", False, "PHC"
    else:
        return "GREEN", 0.70, "General health checkup recommended.", False, "PHC"


def ml_triage(symptoms, age, temperature, heart_rate, spo2):
    symptoms_key = {s.replace(" ", "_").lower() for s in symptoms}
    feature_dict = {}
    for col in vocab["feature_cols"]:
        if col.startswith("symptom_"):
            symptom_name = col.replace("symptom_", "")
            feature_dict[col] = 1 if symptom_name in symptoms_key else 0
        elif col == "age":
            feature_dict[col] = age
        elif col == "temperature":
            feature_dict[col] = temperature if temperature is not None else 37.0
        elif col == "heart_rate":
            feature_dict[col] = heart_rate if heart_rate is not None else 75
        elif col == "spo2":
            feature_dict[col] = spo2 if spo2 is not None else 98

    feature_array = np.array([feature_dict[col] for col in vocab["feature_cols"]]).reshape(1, -1)
    prediction = model.predict(feature_array)[0]
    probabilities = model.predict_proba(feature_array)[0]

    severity = vocab["reverse_severity_map"][str(prediction)]
    confidence = float(max(probabilities))

    if severity == "RED":
        recommendation = "Immediate emergency care required. Transfer to nearest district hospital."
        needs_referral = True
        suggested_facility = "District Hospital"
    elif severity == "YELLOW":
        recommendation = "Priority consultation needed. Visit nearest CHC or higher facility."
        needs_referral = True
        suggested_facility = "CHC"
    else:
        recommendation = "OPD consultation recommended."
        needs_referral = False
        suggested_facility = "PHC"

    return severity, round(confidence, 2), recommendation, needs_referral, suggested_facility


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "MediSync ML Triage Service",
        "model_loaded": model is not None,
    }


@app.post("/triage", response_model=TriageResponse)
async def triage(request: TriageRequest):
    if model is not None and vocab is not None:
        severity, confidence, recommendation, needs_referral, suggested_facility = ml_triage(
            request.symptoms, request.age, request.temperature, request.heart_rate, request.spo2
        )
        model_used = "ml_gradient_boosting"
    else:
        severity, confidence, recommendation, needs_referral, suggested_facility = rule_based_triage(
            request.symptoms, request.age
        )
        model_used = "rule_based_fallback"

    return TriageResponse(
        severity=severity,
        confidence=confidence,
        recommendation=recommendation,
        needs_referral=needs_referral,
        suggested_facility=suggested_facility,
        model_used=model_used,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
