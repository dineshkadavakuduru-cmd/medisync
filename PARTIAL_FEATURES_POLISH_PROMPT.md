# Partially Implemented Features - Polish Prompt for MediSync (SIH 26133)

## Context
MediSync at `C:\Users\Lenovo\ArogyaSetu+\arogyasetu-plus`. Previous missing features (DiagnosticsScreen, Jitsi, ASHA HomeVisit, Offline Sync, Inventory, Predictive Beds, Voice Triage, Wearables) are DONE. Now polish these 6 partially implemented features for winning demo.

**Deployed at**: https://medisync-mobile-7.vercel.app/
**Push to git after completion**

---

## Prompt for Implementation Agent

> **Polish the following 6 partially implemented features to demo-ready state. Each has backend + basic UI but lacks the "wow factor" for SIH evaluation. Work in existing codebase. Follow patterns, TypeScript, i18n (en/hi/mr).**

---

### 1. Assisted Teleconsultation — **HIGH**
**Files to Enhance**:
- `apps/mobile/src/screens/TeleconsultJoinScreen.tsx` — **ADD**: Doctor availability calendar, meeting link copy/share, session timer, prescription writing during call
- `server/src/services/teleconsultService.ts` — **ADD**: `generateMeetingLink()`, `getDoctorAvailability()`, `createPrescription()`
- `apps/mobile/src/screens/TeleconsultListScreen.tsx` — **ADD**: Filter by status, doctor specialty, upcoming/past tabs

**Requirements**:
- **Doctor Availability Calendar**: Weekly recurring slots (Mon-Fri 9-13, 14-17), exception dates, timezone IST
- **Meeting Link**: Auto-generate Jitsi room `medisync-{sessionId}-{timestamp}`, copy to clipboard, share via WhatsApp intent
- **In-Call Prescription**: Doctor writes Rx during call → auto-creates FHIR MedicationRequest → appears in patient timeline
- **Session Timer**: Visible countdown, auto-end at slot limit, extend by 5 min button
- **Status Flow Demo**: REQUESTED → ACCEPTED (shows "Join Call") → IN_PROGRESS (timer) → COMPLETED (shows prescription)

---

### 2. Appointment & Queue Management — **HIGH**
**Files to Enhance**:
- `apps/mobile/src/screens/QueueScreen.tsx` — **ADD**: RED priority jump animation, wait-time estimation, token display
- `apps/mobile/src/screens/AppointmentBookScreen.tsx` — **ADD**: Slot calendar view, priority selection (GREEN/YELLOW/RED), doctor schedule
- `server/src/services/appointmentService.ts` — **ADD**: `calculateWaitTime()`, `reorderQueueForPriority()`, `getAvailableSlots()`

**Requirements**:
- **RED Jump Animation**: When RED patient added, animate card sliding to top with 🚨 pulse, other cards shift down
- **Wait-Time Estimation**: `(position - 1) * avgConsultTime` + priority buffer (RED=0, YELLOW=5min, GREEN=15min)
- **Slot Management**: Calendar heatmap (green=available, yellow=few, red=full), 15-min slots, max 20/day/doctor
- **Token Display**: Large token #, estimated call time, "You're 3rd in queue" with live countdown
- **Priority Booking**: ASHA/Doctor can book RED for emergency, auto-inserts at queue front

---

### 3. Diagnostic Coordination — **HIGH**
**Files to Enhance**:
- `apps/mobile/src/screens/DiagnosticsScreen.tsx` (NEW from previous) — **POLISH**: Condition→test mapping UI, result flagging, auto-order from triage
- `apps/mobile/src/screens/PatientDetailScreen.tsx` — **ENHANCE**: Diagnostics tab with result trends, PDF export
- `server/src/services/diagnosticsService.ts` — **ADD**: `autoOrderFromTriage()`, `flagResults()`, `getConditionTestMap()`

**Requirements**:
- **Condition→Test Mapping UI**: Triage result shows "Recommended Tests" chips (from `triageService.getRecommendedDiagnostics()`), one-tap order all
- **Result Flagging**: NORMAL (green ✓), ABNORMAL (yellow ⚠), CRITICAL (red 🚨) with reference ranges, trend sparkline for repeat tests
- **Auto-Order from Triage**: RED/YELLOW triage → auto-creates diagnostic order with recommended tests, status ORDERED
- **Sample Tracking**: Barcode scan for sample collection → status SAMPLE_COLLECTED → IN_PROGRESS → COMPLETED
- **Critical Alert**: CRITICAL result → push notification to ordering doctor + facility admin

---

### 4. Medicine Availability — **MEDIUM**
**Files to Enhance**:
- `apps/mobile/src/screens/InventoryScreen.tsx` (NEW from previous) — **POLISH**: Stock alerts, consumption tracking, restock PO workflow
- `apps/mobile/src/screens/FacilityScreen.tsx` — **ADD**: Medicine availability drill-down from facility card
- `server/src/services/inventoryService.ts` — **ADD**: `generateRestockPO()`, `trackConsumption()`, `checkThresholds()`

**Requirements**:
- **Stock Alerts**: CRITICAL/OUT_OF_STOCK → push to pharmacist + facility admin + district (WebSocket + SMS fallback)
- **Consumption Tracking**: Daily dispense log per medicine, 7/30-day rolling average, "Days of stock remaining"
- **Restock Workflow**: PO → APPROVED → ORDERED → RECEIVED → VERIFIED → STOCKED, each step timestamped + user
- **Auto-Reorder Suggestion**: "Order 50 Paracetamol (7-day avg: 7/day, stock: 30 → 4 days left)"
- **Category View**: 7 categories (Analgesics, Antibiotics, Antihypertensives, Antidiabetics, Antivenom, Emergency, Maternal)

---

### 5. Longitudinal Patient Records — **MEDIUM**
**Files to Enhance**:
- `apps/mobile/src/screens/PatientDetailScreen.tsx` — **ADD**: Cross-facility timeline, PDF export, immunization, prescriptions
- `server/src/services/fhirService.ts` — **ADD**: `generateContinuityBundle()`, `exportPatientPDF()`
- `apps/mobile/src/screens/PatientsScreen.tsx` — **ADD**: Quick timeline preview on patient card long-press

**Requirements**:
- **Cross-Facility Timeline**: Unified chronological view across Sub-Centre/PHC/CHC/DH, color-coded by facility type
- **PDF Export**: "Share Record" → generates FHIR Bundle → PDF with ABHA QR, timeline, prescriptions, diagnostics, immunizations
- **Prescription History**: All MedicationRequests with status (ACTIVE/COMPLETED/STOPPED), dosage, duration
- **Immunization Record**: Standard schedule (BCG, OPV, DPT, HepB, Measles, JE, VitA), due/overdue badges
- **Referral Summary**: Incoming/outgoing referrals with outcome, linked to timeline events

---

### 6. High-Risk Follow-up — **MEDIUM**
**Files to Enhance**:
- `apps/mobile/src/screens/AshaHomeVisitScreen.tsx` (NEW from previous) — **ADD**: Chronic condition tracking, automated reminders
- `server/src/services/outbreakService.ts` — **ADD**: `scheduleFollowUp()`, `escalateToANM()`, `detectChronicRisks()`
- `apps/mobile/src/screens/HomeScreen.tsx` (ASHA persona) — **ADD**: Follow-up due list, high-risk patient cards

**Requirements**:
- **Maternal/Child Tracking**: ANC due, PNC (0-48h, 7d, 28d), immunization schedule, growth monitoring (weight/height z-score)
- **Chronic Conditions**: HTN/DM/CKD/COPD — last visit, last BP/HbA1c, medication adherence, next review due
- **Automated Reminders**: 24h before due → push to ASHA + patient (SMS), overdue → escalate to ANM
- **Alert Escalation**: High-risk (Hb<7, BP>160/100, sugar>300, danger signs) → auto-create referral + alert ANM/Doctor
- **Follow-Up Dashboard**: ASHA sees "Due Today: 3 ANC, 2 PNC, 5 Immunization, 1 HTN review"

---

## Implementation Order (Priority)

```
Week 1 (Must Polish for Demo):
├── 1. Teleconsultation: Doctor calendar + meeting link + in-call Rx
├── 2. Queue: RED jump animation + wait-time + token display
├── 3. Diagnostics: Condition→test chips + result flags + auto-order

Week 2 (Should Polish):
├── 4. Medicine: Alerts + consumption + restock PO workflow
├── 5. Records: Cross-facility timeline + PDF export + immunization
├── 6. Follow-up: Chronic tracking + reminders + escalation
```

---

## Key Files to Reference (Existing)

| Feature | Backend Service | Mobile Screen | Types |
|---|---|---|---|
| Teleconsult | `teleconsultService.ts` | `TeleconsultJoinScreen`, `TeleconsultListScreen` | `TeleconsultSession` |
| Appointments | `appointmentService.ts` | `QueueScreen`, `AppointmentBookScreen` | `Appointment`, `QueueEntry` |
| Diagnostics | `diagnosticsService.ts` | `DiagnosticsScreen`, `PatientDetailScreen` | `DiagnosticOrder`, `TestResult` |
| Inventory | `inventoryService.ts` | `InventoryScreen`, `FacilityScreen` | `MedicineStock`, `RestockOrder` |
| Records | `fhirService.ts`, `patients.ts` | `PatientDetailScreen`, `PatientsScreen` | `Patient`, `HealthRecord` |
| Follow-up | `outbreakService.ts`, `feedbackService.ts` | `AshaHomeVisitScreen`, `HomeScreen` | `Alert`, `Feedback` |

---

## Acceptance Criteria (Demo-Ready)

### Teleconsultation
- [ ] Doctor sees weekly calendar, sets availability
- [ ] Patient books slot → doctor ACCEPTS → Jitsi link generated
- [ ] Both join → timer starts → doctor writes Rx → auto-saves to timeline
- [ ] Session COMPLETED → prescription visible in patient record

### Queue Management
- [ ] GREEN patients in queue with token #, wait time
- [ ] RED patient added → animates to top with pulse
- [ ] Wait times update live as patients seen
- [ ] ASHA can book RED emergency slot

### Diagnostics
- [ ] Triage RED → "Recommended: Troponin, ECG, CBC" chips
- [ ] One tap orders all → status ORDERED
- [ ] Lab enters results → flags show green/yellow/red
- [ ] CRITICAL → push notification to doctor

### Medicine
- [ ] Pharmacist sees 15 meds with threshold colors
- [ ] Dispense 5 Paracetamol → consumption logged, days remaining updates
- [ ] Stock hits CRITICAL → alert to pharmacist + admin
- [ ] Generate PO → receive → verify → stocked workflow

### Records
- [ ] Patient timeline shows visits from 3+ facilities
- [ ] "Export PDF" → generates branded PDF with ABHA QR
- [ ] Immunization tab shows due/overdue/complete
- [ ] Prescriptions show active/completed/stopped

### Follow-up
- [ ] ASHA home screen shows "Due Today" with counts
- [ ] ANC patient → checklist → high-risk → auto-referral
- [ ] HTN patient overdue → escalate to ANM notification
- [ ] Growth chart for child with z-score interpretation

---

## Commands After Implementation

```bash
# Mobile
cd apps/mobile && npm run lint && npm run typecheck && npx expo export --platform web

# Server
cd server && npm run lint && npm run typecheck

# Build & Deploy
git add -A && git commit -m "Polish: Teleconsult calendar, Queue RED jump, Diagnostics flags, Inventory alerts, Records PDF, Follow-up reminders"
git push origin main
# Vercel auto-deploys from main
```

---

## Notes for Agent

1. **Reuse existing components** — `StatCard`, `SeverityBadge`, `QueueCard`, `AlertCard`, `ReferralCard`
2. **Animation library** — `react-native-reanimated` for queue jump, `react-native-skia` for sparklines
3. **PDF** — `expo-print` + `react-native-html-to-pdf` for record export
4. **Calendar** — `react-native-calendars` for doctor availability
5. **Charts** — `victory-native` or `react-native-chart-kit` for trend sparklines
6. **Demo data** — Seed in `server/src/database/seed.ts`: 5 doctors with schedules, 20 patients with chronic conditions, 10 diagnostic orders with flagged results
7. **Persona-gated** — Doctor calendar only for DOCTOR, Inventory only for PHARMACIST, Follow-up only for ASHA/ANM