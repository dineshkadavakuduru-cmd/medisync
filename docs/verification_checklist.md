# MediSync — Verification Checklist

Use this checklist before the hackathon demo and final submission.  
Check each item as you verify it. Mark any issues with [ ] and resolve before deadline.

---

## Server Section

| # | Check | Command / Action | Status |
|---|-------|-----------------|--------|
| 1 | Development server starts without errors | `npm run dev` in `/server` | [x] |
| 2 | API endpoint: Health check returns 200 | `GET /api/health` | [x] |
| 3 | API endpoint: Symptom checker returns triage result | `POST /api/triage` with sample JSON body | [x] |
| 4 | API endpoint: SOS alert creates a record | `POST /api/emergencies` with sample JSON body | [x] |
| 5 | API endpoint: Patient records can be fetched | `GET /api/patients/:id` | [x] |
| 6 | WebSocket connection established | Check browser console / Socket.IO client | [x] |
| 7 | CORS configured for mobile and web origins | Verify `Access-Control-Allow-Origin` headers | [x] |
| 8 | Teleconsultation sessions API works | `POST /api/teleconsult/sessions` | [x] |
| 9 | Appointment booking API works | `POST /api/appointments` | [x] |
| 10 | Diagnostic orders API works | `POST /api/diagnostics/orders` | [x] |
| 11 | FHIR patient resource generation works | `GET /api/fhir/patient/:abhaId` | [x] |
| 12 | ABDM health ID verification works | `GET /api/abdm/verify/:abhaId` | [x] |

**Server Notes:**
- Default port: 3001 (check `.env` or `server/src/server.ts`)
- New modules: Teleconsultation, Appointments, Diagnostics, FHIR/ABDM all registered in `server/src/server.ts`

---

## Mobile Section

| # | Check | Action | Status |
|---|-------|--------|--------|
| 1 | App starts without crash | `npx expo start` | [x] |
| 2 | Splash screen displays MediSync logo | Launch app from home screen | [x] |
| 3 | Dashboard loads with today's stats | Home screen → check patient count, sync rate | [x] |
| 4 | AI Triage module opens and accepts input | Navigate to Triage → type/voice symptoms | [x] |
| 5 | Emergency SOS module triggers alert | Navigate to SOS → fill patient details → tap SOS | [x] |
| 6 | Language switcher works (Marathi/Hindi/English) | Settings → Language → change → verify UI updates | [x] |
| 7 | Voice input records speech and converts to text | Triage screen → tap mic → speak → verify transcription | [x] |
| 8 | Offline mode functional | Enable airplane mode → verify app still navigates | [x] |
| 9 | Patients list loads and search works | Patients tab → search by name/ID | [x] |
| 10 | Facility view shows PHC/CHC details | Facility tab → verify bed count, stock levels | [x] |
| 11 | Teleconsultation list and join works | Teleconsult tab → view sessions → join call | [x] |
| 12 | Appointment booking works | Appointments tab → book appointment → view queue | [x] |
| 13 | Patient diagnostics tab shows test results | Patient Detail → Diagnostics tab | [x] |

**Mobile Notes:**
- Minimum Android version: 8.0 (API 26)
- Test on real device if possible, emulator as fallback

---

## Web Section

| # | Check | Action | Status |
|---|-------|--------|--------|
| 1 | Landing page loads with correct branding | Open `localhost:3000/welcome` | [x] |
| 2 | District dashboard renders | Login as admin → verify dashboard loads | [x] |
| 3 | Emergency Centre view shows live alerts | Navigate to Emergency Centre → verify real-time updates | [x] |
| 4 | Analytics charts render correctly | Navigate to Analytics → verify charts (line, bar, map) load | [x] |
| 5 | Sidebar navigation works on all screen sizes | Click each sidebar link → verify route change | [x] |
| 6 | Toast notifications appear for actions | Perform an action (e.g., save patient) → verify toast | [x] |
| 7 | Responsive layout on tablet (768px) | Resize browser → verify no horizontal scroll, proper stacking | [x] |
| 8 | Responsive layout on mobile (375px) | Resize browser → verify hamburger menu, stacked cards | [x] |
| 9 | Teleconsultation page works | Navigate to Teleconsult → create session → view list | [x] |
| 10 | Appointments page works | Navigate to Appointments → book → view queue | [x] |
| 11 | Diagnostics page works | Navigate to Diagnostics → view orders → add results | [x] |
| 12 | Diagnostic Utilization chart renders | Analytics page → verify diagnostic chart | [x] |

**Web Notes:**
- Test in Chrome, Firefox, and Edge
- Verify all charts use mock/demo data if backend not fully connected

---

## Demo Readiness Section

| # | Check | Action | Status |
|---|-------|--------|--------|
| 1 | Simulator / demo environment stable | No crashes during 3 consecutive full demo runs | [x] |
| 2 | Demo script timed and rehearsed | Run through `docs/PPT/demo_script.md` — target ≤ 5:30 | [x] |
| 3 | PPT / Canva deck ready and tested on projector | Open `docs/PPT/ppt_content.md` slides → test resolution | [x] |
| 4 | Team readiness — each member knows their section | Assign 1 presenter per module → brief 5-min dry run | [x] |
| 5 | Solution Brief created | `SOLUTION_BRIEF.md` maps PS26133 requirements to codebase | [x] |
| 6 | FHIR/ABDM interoperability demonstrated | Show FHIR resource generation + ABDM verification | [x] |

**Demo Readiness Notes:**
- Have backup screenshots / video recording in case of live demo failure
- Test projector / HDMI connection before the event
- Prepare printed handouts of the PPT if allowed
- New modules to demo: Teleconsultation, Appointments, Diagnostics, FHIR/ABDM

---

## Final Gate

- [x] All Server checks passed
- [x] All Mobile checks passed
- [x] All Web checks passed
- [x] Demo Readiness checks passed

**Verified by:** MediSync Development Team
**Date:** 2026-08-31
**Notes:** All PS26133 expected solution components implemented. New modules: Teleconsultation, Appointments & Queue, Diagnostic Coordination, FHIR/ABDM Interoperability. ML triage upgraded from rule-based to trained GradientBoosting classifier.

---

*End of Verification Checklist*
