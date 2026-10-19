# Changelog

All notable changes to the MediSync / ArogyaSetu+ demo prototype.

## [Unreleased]

### Added
- Server IST time helpers (`server/src/services/istTime.ts`) so all clinic scheduling is interpreted as India Standard Time (UTC+05:30) regardless of host timezone.
- Server-mode teleconsult request creation in the mobile app: `TeleconsultListScreen` now has a "New consultation request" form (patient, clinician, date, free slot) that works in both demo and connected modes.
- `teleconsultClient.listDoctors()` and `teleconsultClient.create()`; both fall back to a local roster in demo mode.
- Persistent consultation timer: the 30-minute target is stored per session and the embedded meeting auto-closes at expiry, with "Add 5 min" to reopen.
- Prescription to referral handoff: a saved prescription now offers "Create referral for this patient", opening the triage/referral flow with patient and facility pre-filled.
- WhatsApp share now tries the native `whatsapp://` transport first, then `wa.me`, and copies the meeting link when neither is available.
- Server test suite for appointments and teleconsult scheduling (`server/test/appointments.test.ts`).

### Changed
- `getAvailableSlotsForDoctor` now uses IST weekdays, filters out slots whose IST start time has passed, and matches booked sessions by normalised IST date/time.
- `createSession` rejects a future consultation slot that is outside clinician hours or already booked (`409`).
- Appointments: server-side validation (types, priority, facility, doctor), future-only booking, clinician-schedule membership, and double-booking rejection (`409`); `POST /api/appointments` and related routes now use strict zod schemas.
- Appointment demo seed data now targets real future IST slots instead of arbitrary offsets.
- Mobile appointment booking compares slots against IST instants and builds the calendar in IST.
- `TeleconsultJoinScreen` derives the simulated role from the active persona and updates when the persona changes.

### Fixed
- Removed the exposed Gemini API key from the workspace `.env` (the key must be rotated; it was never committed to git history).

### Security
- Rotate the previously exposed `GEMINI_API_KEY`; it is no longer present in any tracked or untracked project file.
