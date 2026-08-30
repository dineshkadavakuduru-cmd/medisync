# ArogyaSetu+ — Verification Checklist

Use this checklist before the hackathon demo and final submission.  
Check each item as you verify it. Mark any issues with [ ] and resolve before deadline.

---

## Server Section

| # | Check | Command / Action | Status |
|---|-------|-----------------|--------|
| 1 | Development server starts without errors | `npm run dev` in `/server` | [ ] |
| 2 | API endpoint: Health check returns 200 | `GET /api/health` | [ ] |
| 3 | API endpoint: Symptom checker returns triage result | `POST /api/triage` with sample JSON body | [ ] |
| 4 | API endpoint: SOS alert creates a record | `POST /api/sos` with sample JSON body | [ ] |
| 5 | API endpoint: Patient records can be fetched | `GET /api/patients/:id` | [ ] |
| 6 | WebSocket connection established on `/socket.io/` | Check browser console / Socket.IO client | [ ] |
| 7 | CORS configured for mobile and web origins | Verify `Access-Control-Allow-Origin` headers | [ ] |

**Server Notes:**
- Default port: 3000 or 5000 (check `.env` or `server/index.js`)
- Database: PostgreSQL must be running before `npm run dev`

---

## Mobile Section

| # | Check | Action | Status |
|---|-------|--------|--------|
| 1 | App starts without crash | `npx react-native run-android` or `run-ios` | [ ] |
| 2 | Splash screen displays ArogyaSetu+ logo | Launch app from home screen | [ ] |
| 3 | ASHA Worker login works | Use demo credentials: `asha@sangli.gov.in` / `demo123` | [ ] |
| 4 | Dashboard loads with today's stats | Home screen → check patient count, sync rate | [ ] |
| 5 | AI Triage module opens and accepts input | Navigate to Triage → type/voice symptoms | [ ] |
| 6 | Emergency SOS module triggers alert | Navigate to SOS → fill patient details → tap SOS | [ ] |
| 7 | Language switcher works (Marathi/Hindi/English) | Settings → Language → change → verify UI updates | [ ] |
| 8 | Voice input records speech and converts to text | Triage screen → tap mic → speak → verify transcription | [ ] |
| 9 | Offline mode functional | Enable airplane mode → verify app still navigates | [ ] |
| 10 | Patients list loads and search works | Patients tab → search by name/ID | [ ] |
| 11 | Facility view shows PHC/CHC details | Facility tab → verify bed count, stock levels | [ ] |

**Mobile Notes:**
- Minimum Android version: 8.0 (API 26)
- Test on real device if possible, emulator as fallback

---

## Web Section

| # | Check | Action | Status |
|---|-------|--------|--------|
| 1 | Landing page loads with correct branding | Open `https://arogyasetu-plus.vercel.app` or `localhost:3000` | [ ] |
| 2 | Admin/District dashboard renders | Login as admin → verify dashboard loads | [ ] |
| 3 | Emergency Centre view shows live alerts | Navigate to Emergency Centre → verify real-time updates | [ ] |
| 4 | Analytics charts render correctly | Navigate to Analytics → verify charts (line, bar, map) load | [ ] |
| 5 | Sidebar navigation works on all screen sizes | Click each sidebar link → verify route change | [ ] |
| 6 | Toast notifications appear for actions | Perform an action (e.g., save patient) → verify toast | [ ] |
| 7 | Responsive layout on tablet (768px) | Resize browser → verify no horizontal scroll, proper stacking | [ ] |
| 8 | Responsive layout on mobile (375px) | Resize browser → verify hamburger menu, stacked cards | [ ] |

**Web Notes:**
- Test in Chrome, Firefox, and Edge
- Verify all charts use mock/demo data if backend not fully connected

---

## Demo Readiness Section

| # | Check | Action | Status |
|---|-------|--------|--------|
| 1 | Simulator / demo environment stable | No crashes during 3 consecutive full demo runs | [ ] |
| 2 | Demo script timed and rehearsed | Run through `docs/PPT/demo_script.md` — target ≤ 5:30 | [ ] |
| 3 | PPT / Canva deck ready and tested on projector | Open `docs/PPT/ppt_content.md` slides → test resolution | [ ] |
| 4 | Team readiness — each member knows their section | Assign 1 presenter per module → brief 5-min dry run | [ ] |

**Demo Readiness Notes:**
- Have backup screenshots / video recording in case of live demo failure
- Test projector / HDMI connection before the event
- Prepare printed handouts of the PPT if allowed

---

## Final Gate

- [ ] All Server checks passed
- [ ] All Mobile checks passed
- [ ] All Web checks passed
- [ ] Demo Readiness checks passed

**Verified by:** ___________________  
**Date:** ___________________  
**Notes:** ___________________

---

*End of Verification Checklist*
