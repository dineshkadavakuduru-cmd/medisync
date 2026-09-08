# Missing Features Implementation Prompt for MediSync (SIH 26133)

## Context
MediSync is a rural healthcare platform for SIH 2026 PS26133. The codebase is at `C:\Users\Lenovo\ArogyaSetu+\arogyasetu-plus`. It uses:
- Mobile: Expo/React Native (TypeScript) with WatermelonDB offline cache
- Web: Next.js 14 + Tailwind
- Backend: Node.js/Fastify/TypeScript + PostgreSQL/PostGIS
- ML: Python/FastAPI + GradientBoosting triage model
- Real-time: Socket.IO WebSockets
- Interop: FHIR R4 + ABDM (ABHA)

---

## Prompt for Implementation Agent

> **Implement the following 8 missing features for MediSync to make it a winning SIH 26133 prototype. Work in the existing codebase at `C:\Users\Lenovo\ArogyaSetu+\arogyasetu-plus`. Follow existing patterns, TypeScript types, and i18n (en/hi/mr).**

---

### 1. DiagnosticsScreen (Mobile) — **CRITICAL**
**File**: `apps/mobile/src/screens/DiagnosticsScreen.tsx` (NEW)
**Navigator**: Add to `AppNavigator.tsx`
**Requirements**:
- List diagnostic orders for current patient/facility
- Create new order from triage results (auto-populate tests via `triageService.getRecommendedDiagnostics()`)
- Show test results with flags: NORMAL (green), ABNORMAL (yellow), CRITICAL (red)
- Status flow: ORDERED → SAMPLE_COLLECTED → IN_PROGRESS → COMPLETED
- Pull-to-refresh, offline queue for order creation
- Use existing `api.ts` endpoints: `/api/diagnostics/orders`, `/api/diagnostics/tests`

---

### 2. Teleconsultation Video Call — **CRITICAL**
**Files**: 
- `apps/mobile/src/screens/TeleconsultJoinScreen.tsx` (MODIFY)
- `server/src/services/teleconsultService.ts` (MODIFY - add Jitsi meeting URL)
**Requirements**:
- Integrate `@jitsi/react-native-sdk` (Expo compatible)
- Auto-generate meeting link on session ACCEPTED
- Join screen: mic/camera toggle, screen share, end call
- Doctor & patient both join same room
- Fallback: show meeting URL if SDK fails
- Session lifecycle: REQUESTED → ACCEPTED → IN_PROGRESS → COMPLETED

---

### 3. ASHA Home-Visit Workflow — **CRITICAL**
**File**: `apps/mobile/src/screens/AshaHomeVisitScreen.tsx` (NEW)
**Navigator**: Add to `AppNavigator.tsx` (ASHA persona only)
**Requirements**:
- ANC due list: filter patients by trimester, last visit > 30 days
- Visit checklist per trimester:
  - 1st: BP, weight, Hb, urine albumin, HIV/syphilis, TT1
  - 2nd: BP, weight, fundal height, Hb, TT2, IFA
  - 3rd: BP, weight, fundal height, presentation, TT booster
- Offline-first form (WatermelonDB) → sync when online
- High-risk flags: anemia (Hb<11), hypertension (BP>140/90), preterm signs
- Auto-create referral if high-risk detected
- Voice input for findings (Hindi/Marathi)

---

### 4. Offline Sync Demo — **HIGH**
**Files**:
- `apps/mobile/src/components/NetworkBanner.tsx` (ENHANCE)
- `apps/mobile/src/database/*.ts` (VERIFY WatermelonDB sync)
- `apps/mobile/src/services/syncService.ts` (NEW or enhance)
**Requirements**:
- Visual sync indicator: pending count badge on bottom nav
- Airplane mode demo: create referral → shows "⏳ Pending Sync"
- Reconnect → animated sync progress → "✅ Synced"
- Conflict resolution: server wins, show toast
- Demo data: pre-seed 5 offline actions for live demo

---

### 5. Medicine Inventory Management — **HIGH**
**File**: `apps/mobile/src/screens/InventoryScreen.tsx` (NEW)
**Navigator**: Add to `AppNavigator.tsx` (PHARMACIST persona - add to personas.ts)
**Requirements**:
- 15 essential medicines × 7 categories (from `inventoryService.ts`)
- Stock levels with thresholds: ADEQUATE (>60%), LOW (30-60%), CRITICAL (<30%), OUT_OF_STOCK (0)
- Consumption tracking: daily dispense log
- Auto-reorder suggestions based on 7-day rolling average
- Restock workflow: PO → RECEIVED → VERIFIED
- Low-stock alerts pushed to facility admin + district
- Barcode scan for receive (expo-barcode-scanner)

---

### 6. Predictive Bed Forecasting — **MEDIUM (DIFFERENTIATOR)**
**Files**:
- `ml/api/main.py` (ADD `/predict/beds` endpoint)
- `ml/training/train_bed_model.py` (NEW - LSTM on historical turnover)
- `apps/mobile/src/screens/FacilityDetailScreen.tsx` (MODIFY - show prediction)
**Requirements**:
- Train LSTM on 90 days synthetic bed occupancy per facility
- Predict available beds at 6h/12h/24h/48h horizons
- Show on FacilityDetailScreen: "🔮 Predicted: 12 ICU beds in 6h"
- Simple heuristic fallback if ML unavailable: moving average + trend

---

### 7. Voice-based Triage (Hindi/Marathi) — **MEDIUM**
**Files**:
- `apps/mobile/src/components/VoiceInputButton.tsx` (ENHANCE)
- `apps/mobile/src/screens/TriageFlowScreen.tsx` (INTEGRATE)
- `apps/mobile/src/services/voiceService.ts` (ADD Bhashini/Whisper)
**Requirements**:
- "🎤 बोलकर लक्षण बताएं" button in symptom selection step
- Speech-to-text: prefer Bhashini API (Indian languages), fallback Whisper/Web Speech API
- Auto-map recognized symptoms to symptom chips
- Works offline for basic commands (on-device)
- Text-to-speech for result reading (already has expo-speech)

---

### 8. Wearables Integration (SpO2/BP) — **MEDIUM**
**Files**:
- `apps/mobile/src/services/bluetoothService.ts` (NEW)
- `apps/mobile/src/screens/EmergencyDetailScreen.tsx` (MODIFY - live vitals)
- `server/src/services/emergencyService.ts` (ADD vitals streaming endpoint)
**Requirements**:
- Bluetooth LE scan for generic health devices (SpO2, BP cuff)
- GATT profiles: Heart Rate (0x180D), Blood Pressure (0x1810), SpO2 (0x1822)
- Stream vitals during IN_TRANSIT → WebSocket to receiving hospital
- Demo mode: simulate device with mock data generator
- Show live chart on EmergencyDetailScreen for paramedic/doctor

---

## Implementation Order (Priority)

```
Week 1 (Must Have):
├── 1. DiagnosticsScreen
├── 2. Teleconsultation Video (Jitsi)
├── 3. ASHA Home-Visit Screen

Week 2 (Should Have):
├── 4. Offline Sync Demo Polish
├── 5. Medicine Inventory Screen
├── 6. Add PHARMACIST persona

Week 3 (Nice to Have - Differentiators):
├── 7. Predictive Bed Forecasting (LSTM)
├── 8. Voice Triage (Bhashini)
├── 9. Wearables Bluetooth LE
```

---

## Key Existing Files to Reference

| Purpose | File |
|---|---|
| Types | `packages/shared/src/types/index.ts` |
| API client | `apps/mobile/src/services/api.ts` |
| i18n | `apps/mobile/src/i18n/translations/{en,hi,mr}.json` |
| Theme | `apps/mobile/src/styles/theme.ts` |
| Navigation | `apps/mobile/src/navigation/AppNavigator.tsx` |
| Personas | `apps/mobile/src/services/personas.ts` |
| Triage logic | `server/src/services/triageService.ts` |
| FHIR | `server/src/services/fhirService.ts` |
| ML API | `ml/api/main.py` |
| Database models | `apps/mobile/src/database/models/*.ts` |

---

## Acceptance Criteria for Each Feature

### DiagnosticsScreen
- [ ] Accessible from bottom nav (Diagnostics tab)
- [ ] Create order pre-filled from triage result
- [ ] Results show NORMAL/ABNORMAL/CRITICAL with colors
- [ ] Works offline (queues create order)

### Teleconsultation Video
- [ ] Doctor & patient join same Jitsi room
- [ ] Meeting link generated on ACCEPTED
- [ ] Mic/camera/screen-share controls work
- [ ] Session status updates to IN_PROGRESS/COMPLETED

### ASHA Home-Visit
- [ ] ANC due list filtered by trimester
- [ ] Checklist saves offline, syncs online
- [ ] High-risk auto-creates referral
- [ ] Voice input works for Hindi/Marathi

### Offline Sync
- [ ] NetworkBanner shows online/offline
- [ ] Pending sync badge on nav
- [ ] Airplane mode demo works end-to-end
- [ ] Conflict resolution toast shown

### Medicine Inventory
- [ ] 15 medicines × 7 categories displayed
- [ ] Threshold colors correct
- [ ] Restock workflow complete
- [ ] Low-stock alert triggers

### Predictive Beds
- [ ] LSTM model trains on synthetic data
- [ ] `/predict/beds` returns 6h/12h/24h/48h
- [ ] FacilityDetail shows prediction badge
- [ ] Fallback to moving average

### Voice Triage
- [ ] Mic button in symptom step
- [ ] STT works for Hindi/Marathi
- [ ] Symptoms auto-selected from speech
- [ ] TTS reads result aloud

### Wearables
- [ ] BLE scan finds mock device
- [ ] SpO2/BP/HR stream to WebSocket
- [ ] Live chart on EmergencyDetail
- [ ] Demo mode simulates device

---

## Commands to Run After Implementation

```bash
# Mobile
cd apps/mobile && npm run lint && npm run typecheck

# Server
cd server && npm run lint && npm run typecheck

# ML
cd ml && python -m pytest tests/ -v

# Build mobile for web demo
cd apps/mobile && npx expo export --platform web
```

---

## Notes for Agent

1. **Don't break existing features** — run lint/typecheck after each feature
2. **Use existing patterns** — copy style from `TriageFlowScreen`, `FacilityScreen`, `ReferralScreen`
3. **i18n everything** — add keys to en/hi/mr JSON files
4. **Offline-first** — every create/update goes to WatermelonDB first
5. **Demo-ready** — seed data in `server/src/database/seed.ts` for each feature
6. **Persona-gated** — Inventory only for PHARMACIST, HomeVisit only for ASHA