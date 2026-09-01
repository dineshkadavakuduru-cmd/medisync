# MediSync — PS26133 Solution Brief

**Problem Statement:** SIH26133 — "Accessibility and quality of public healthcare services, particularly in rural and underserved areas"
**Organization:** Government of Maharashtra (Maharashtra State Innovation Society)
**Theme:** MedTech / BioTech / HealthTech
**Event:** Smart India Hackathon 2026

---

## PS26133 Expected Solution → MediSync Implementation Map

### Core Expected Components

| # | PS26133 Expected Component | MediSync Implementation | Key Files |
|---|---------------------------|---------------------------|-----------|
| 1 | **Assisted teleconsultation** | Teleconsultation module with session lifecycle (REQUESTED→ACCEPTED→IN_PROGRESS→COMPLETED), doctor availability, meeting link generation, mobile video call UI | `server/src/routes/teleconsult.ts`, `server/src/services/teleconsultService.ts`, `apps/mobile/src/screens/TeleconsultListScreen.tsx`, `apps/mobile/src/screens/TeleconsultJoinScreen.tsx`, `apps/web/src/app/teleconsult/page.tsx` |
| 2 | **Appointment & queue management** | Full appointment booking with priority queuing (RED patients jump queue), slot management, live queue display, wait time estimation | `server/src/routes/appointments.ts`, `server/src/services/appointmentService.ts`, `apps/mobile/src/screens/AppointmentBookScreen.tsx`, `apps/mobile/src/screens/QueueScreen.tsx`, `apps/web/src/app/appointments/page.tsx` |
| 3 | **Digital triage** | AI-powered triage with RED/YELLOW/GREEN severity, Gemini clinical decision support, ML-trained GradientBoosting classifier, multilingual symptom input | `server/src/routes/triage.ts`, `server/src/services/triageService.ts`, `server/src/services/aiService.ts`, `ml/api/main.py`, `ml/training/train_triage_model.py` |
| 4 | **Longitudinal patient records** | ABHA-linked patient records, health timeline across facilities, multilingual patient data, diagnostics history tab | `server/src/routes/patients.ts`, `server/src/database/patients.ts`, `apps/mobile/src/screens/PatientDetailScreen.tsx` |
| 5 | **Referral tracking** | Full referral lifecycle (CREATED→ACCEPTED→IN_TRANSIT→ARRIVED→COMPLETED→DROPPED), GIS-based routing, QR codes, distance calculation | `server/src/routes/referrals.ts`, `server/src/services/referralRouter.ts` |
| 6 | **Diagnostic coordination** | Lab test ordering, condition→test mapping, result tracking with NORMAL/ABNORMAL/CRITICAL flags, auto-ordering from triage | `server/src/routes/diagnostics.ts`, `server/src/services/diagnosticsService.ts` |
| 7 | **Medicine availability** | Per-facility inventory with thresholds, stock alerts, consumption tracking, 15 essential medicines across 7 categories | `server/src/services/inventoryService.ts`, `server/src/routes/facilities.ts` |
| 8 | **High-risk patient follow-up** | Outbreak detection with statistical anomaly scoring, alert system, patient feedback collection | `server/src/services/outbreakService.ts`, `server/src/services/feedbackService.ts`, `server/src/routes/alerts.ts` |
| 9 | **Facility dashboards** | Real-time district command centre, facility analytics, performance scoring, bed/medicine/staff tracking | `server/src/routes/analytics.ts`, `apps/web/src/app/page.tsx` |

### Required Support Capabilities

| Capability | Implementation |
|-----------|---------------|
| **Frontline health workers** | ASHA, Doctor, Nurse, ANM, Pharmacist, Lab Tech roles; ASHA-specific workflows |
| **Low-connectivity environments** | WatermelonDB SQLite offline cache on mobile, NetworkBanner, sync queue, demo/mock fallback |
| **Multilingual interaction** | Full en/hi/mr i18n framework, symptom labels in 3 scripts, voice output via expo-speech |
| **Emergency escalation** | 3-level emergency protocol (L1/L2/L3), auto-escalation timers, SMS/Push/WebSocket dispatch, ambulance dispatch with ETA |
| **Interoperable health records (FHIR/ABDM)** | FHIR R4 resource generation (Patient, Encounter, Observation, Condition, ServiceRequest), ABDM health ID verification, consent artifacts, FHIR Bundle import/export |

---

## API Endpoints Summary

### New Endpoints (Implemented in this phase)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/teleconsult/sessions` | List teleconsultation sessions |
| POST | `/api/teleconsult/sessions` | Create teleconsultation session |
| GET | `/api/teleconsult/sessions/:id` | Get session details |
| PATCH | `/api/teleconsult/sessions/:id/status` | Update session status |
| GET | `/api/teleconsult/doctors` | List available doctors |
| GET | `/api/appointments` | List appointments (filterable by facility/patient/doctor) |
| POST | `/api/appointments` | Book appointment |
| PATCH | `/api/appointments/:id/status` | Update appointment status |
| GET | `/api/appointments/queue/:facilityId` | Get live facility queue |
| GET | `/api/appointments/slots/:facilityId/:date` | Get available time slots |
| GET | `/api/diagnostics/tests` | List available diagnostic tests |
| GET | `/api/diagnostics/orders` | List diagnostic orders |
| POST | `/api/diagnostics/orders` | Create diagnostic order |
| PATCH | `/api/diagnostics/orders/:id/result` | Add test result |
| PATCH | `/api/diagnostics/orders/:id/status` | Update order status |
| GET | `/api/fhir/patient/:abhaId` | Get FHIR Patient resource |
| GET | `/api/fhir/patient/:abhaId/bundle` | Get FHIR Bundle for patient |
| POST | `/api/fhir/condition` | Create FHIR Condition |
| POST | `/api/fhir/observations` | Create FHIR Observations from triage |
| POST | `/api/fhir/import` | Import FHIR Bundle |
| GET | `/api/abdm/verify/:abhaId` | Verify ABHA health ID |
| POST | `/api/abdm/generate-otp/:abhaId` | Generate ABDM OTP |
| POST | `/api/abdm/verify-otp` | Verify ABDM OTP |
| POST | `/api/abdm/consent` | Create consent artifact |
| GET | `/api/abdm/consent/:id` | Get consent details |
| PATCH | `/api/abdm/consent/:id/status` | Update consent status |

### Existing Endpoints (Previously implemented)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/triage` | AI-powered symptom triage |
| GET | `/api/triage/symptoms` | Symptom catalogue (multilingual) |
| POST | `/api/patients` | Create patient (ABHA ID) |
| GET | `/api/patients/:id/records` | Health record timeline |
| POST | `/api/referrals` | Create referral with smart routing |
| GET | `/api/emergencies` | Emergency list & dispatch |
| POST | `/api/emergencies/:id/dispatch` | Ambulance dispatch |
| GET | `/api/facilities/:id/summary` | Facility dashboard |
| GET | `/api/analytics/dashboard` | District-level stats |
| GET | `/api/analytics/outbreaks` | Anomaly-based outbreak alerts |

---

## Database Schema (New Tables)

- `teleconsult_sessions` — Teleconsultation session records
- `appointments` — Appointment bookings with priority
- `diagnostic_orders` — Lab test orders
- `test_results` — Individual test results with flags
- `fhir_mappings` — Internal ID ↔ FHIR resource ↔ ABHA ID mappings

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo / React Native / WatermelonDB (SQLite) |
| Web | Next.js 14 / TypeScript / Tailwind CSS |
| Backend | Node.js / Fastify / TypeScript |
| Database | PostgreSQL + PostGIS |
| ML Service | Python / FastAPI / scikit-learn (GradientBoosting) |
| AI | Gemini 2.0 Flash (clinical decision support) |
| Real-time | WebSocket (Socket.IO) |
| Interoperability | FHIR R4 / ABDM (Ayushman Bharat Digital Mission) |
| Mapping | Leaflet / OpenStreetMap |

---

## SIH 2026 Readiness Status

| Deliverable | Status |
|------------|--------|
| Backend API (all modules) | ✅ Complete |
| Web Dashboard | ✅ Complete |
| Mobile App | ✅ Complete |
| ML Triage Service | ✅ Complete (trained model + rule fallback) |
| FHIR/ABDM Interoperability | ✅ Complete |
| Database Schema | ✅ Complete |
| PPT Content | ✅ Complete |
| Demo Script | ✅ Complete |
| Verification Checklist | ✅ Complete |
| Solution Brief | ✅ Complete (this file) |
