from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import uvicorn

app = FastAPI(title="ArogyaSetu+ ML Triage Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TriageRequest(BaseModel):
    symptoms: List[str] = Field(..., description="List of patient symptoms")
    age: int = Field(..., ge=0, le=150, description="Patient age in years")
    gender: str = Field(..., description="Patient gender: male/female/other")


class TriageResponse(BaseModel):
    severity: str
    confidence: float
    recommendation: str
    needs_referral: bool
    suggested_facility: str


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ArogyaSetu+ ML Triage Service"}


@app.post("/triage", response_model=TriageResponse)
async def triage(request: TriageRequest):
    lower_symptoms = [s.lower() for s in request.symptoms]

    red_symptoms = ["chest pain", "unconscious", "severe bleeding", "difficulty breathing"]
    yellow_symptoms = ["high fever", "persistent vomiting", "abdominal pain"]

    if any(s in lower_symptoms for s in red_symptoms):
        severity = "RED"
        confidence = 0.95
        recommendation = "Immediate emergency care required. Transfer to nearest district hospital."
        needs_referral = True
        suggested_facility = "District Hospital"
    elif any(s in lower_symptoms for s in yellow_symptoms):
        severity = "YELLOW"
        confidence = 0.82
        recommendation = "Priority consultation needed. Visit nearest CHC or higher facility."
        needs_referral = True
        suggested_facility = "CHC"
    elif "fever" in lower_symptoms:
        severity = "YELLOW"
        confidence = 0.75
        recommendation = "Malaria/Dengue screening recommended. Rest and hydration."
        needs_referral = False
        suggested_facility = "PHC"
    elif any(s in lower_symptoms for s in ["cough", "cold", "headache"]):
        severity = "GREEN"
        confidence = 0.80
        recommendation = "Respiratory infection likely. Rest and symptomatic treatment."
        needs_referral = False
        suggested_facility = "PHC"
    else:
        severity = "GREEN"
        confidence = 0.70
        recommendation = "General health checkup recommended."
        needs_referral = False
        suggested_facility = "PHC"

    return TriageResponse(
        severity=severity,
        confidence=confidence,
        recommendation=recommendation,
        needs_referral=needs_referral,
        suggested_facility=suggested_facility,
    )


if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
