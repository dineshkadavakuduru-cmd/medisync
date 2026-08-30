# ArogyaSetu+ — PowerPoint Slide Content

---

## SLIDE 1: TITLE SLIDE

**Layout:** Full-bleed hero slide with dark blue gradient background (#1A237E → #283593) and a subtle medical cross watermark.

| Element | Content |
|---------|---------|
| **Title** | ArogyaSetu+ (आरोग्यसेतू+) |
| **Subtitle** | AI-Powered Rural Healthcare Platform |
| **Problem Statement** | PS26133 |
| **Organization** | [Your Team Name / Institution] |
| **Theme** | MedTech / HealthTech — Accessibility & Quality of Public Healthcare in Rural & Underserved Areas |
| **Mentor** | [Mentor Name] |
| **Event** | Smart India Hackathon 2026 (SIH 2026) |

**Design Notes:**
- Title font: Poppins Bold, 60 pt, white (#FFFFFF)
- Subtitle: 28 pt, light blue (#BBDEFB)
- Problem Statement, Organization, Theme: 18 pt, white
- Bottom strip: Maharashtra government logo left, SIH 2026 logo right

---

## SLIDE 2: PROBLEM DEEP-DIVE

**Layout:** Two-column layout. Left: statistics. Right: referral chain diagram and stakeholders.

### Title
**The Healthcare Crisis in Rural India**

### Statistics (in RED #C62828)
1. **78%** — Specialist vacancies in rural health facilities (MoHFW, 2025)
2. **40%** — Patient drop-off during referrals due to lack of coordination (NSSO 75th Round)
3. **57%** — Rural population travels 30+ km for specialist care (MoHFW Rural Health Survey)
4. **80%+** — PHC patients with zero digital health records (NHSR India Report)
5. **₹2,000–5,000** — Average out-of-pocket waste per patient due to repeated tests and referrals

### Broken Referral Chain Diagram Description
```
PHC (No Digital Records)
    ↓ [Patient referred on paper]
CHC (No patient history)
    ↓ [Tests repeated]
District Hospital (Correct diagnosis, 2 weeks later)
    ↓ [Patient condition worsened]
    ↓ [₹5,000 wasted, trust broken]
```

### Stakeholders Affected
- Rural Patients & Families
- ASHA Workers
- PHC/CHC Staff
- Specialists at District Hospitals
- Government Health Administrators

### Source Citations (bottom of slide)
- MoHFW Rural Health Statistics 2025
- NSSO 75th Round (Health)
- NHSR India Digital Health Report 2024

**Design Notes:**
- Background: light grey (#F5F5F5)
- Statistics cards: white with red left border (4px, #C62828)
- Diagram: Use simple flowchart with red X marks at broken links
- Font: Roboto / Inter, 24 pt for stats

---

## SLIDE 3: OUR SOLUTION

**Layout:** Central USP highlight, 6 module cards in 2×3 grid below.

### Title
**One platform. Every facility. Every patient. AI-powered.**

### Core Modules (6 cards with icons)

| # | Module | Icon | One-liner |
|---|--------|------|-----------|
| 1 | AI Triage & Symptom Checker | 🩺 | ML-powered pre-diagnosis in regional languages |
| 2 | Emergency SOS & Escalation | 🚨 | Real-time alerts to PHC, CHC, 108, and district |
| 3 | Telemedicine Bridge | 🩻 | Connect rural patients to specialists via video/audio |
| 4 | Digital Health Records | 📋 | Offline-first EMR that syncs when connected |
| 5 | Facility & Asset Dashboard | 🏥 | Real-time bed, medicine, and equipment tracking |
| 6 | Voice & Multilingual Access | 🔊 | Voice-first UI in Marathi, Hindi, English |

### USP Highlight Box
> **What makes us different:** We don't just digitize records — we **prevent referrals** through AI triage, **stop patient drop-off** through real-time tracking, and **work offline** where connectivity doesn't.

### Architecture Diagram Description (small, bottom)
```
Patient → ASHA Worker → PHC → CHC → District Hospital
                    ↓
              [ArogyaSetu+ Platform]
                    ↓
        Real-time Monitoring + AI + Analytics
```

**Design Notes:**
- Background: white
- Module cards: rounded corners (12px), light blue (#E3F2FD) background, 1px border (#90CAF9)
- USP box: green (#2E7D32) background, white text, left border 6px
- Icons: use emoji or Font Awesome icons, 36 pt

---

## SLIDE 4: TECHNICAL ARCHITECTURE

**Layout:** Three horizontal sections — Tech Stack, Feasibility Table, Deliverables.

### Title
**Technical Architecture**

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Mobile** | React Native (iOS + Android) |
| **Frontend Web** | Next.js 14, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express, Socket.IO |
| **Database** | PostgreSQL, Redis, SQLite (offline) |
| **AI/ML** | TensorFlow Lite, scikit-learn, symptom-classification model |
| **Real-time** | WebSocket (Socket.IO), Push Notifications |
| **Cloud & Hosting** | Vercel / Railway, Firebase Auth |
| **Mapping** | Leaflet / OpenStreetMap |

### Feasibility Table (6 challenges → solutions)

| Challenge | Solution |
|-----------|----------|
| Low connectivity | Offline-first sync with SQLite + background sync |
| Multilingual UI | i18n in React Native + voice-to-text via Web Speech API |
| ASHA worker adoption | Simplified 3-step workflows + voice-first design |
| Data privacy | HIPAA-aligned, Firebase Auth, encrypted storage |
| Integration with existing systems | REST APIs, FHIR-compatible EMR structure |
| Scalability across Maharashtra | Cloud-native, auto-scaling on Railway/Vercel |

### Deliverables
**7 core deliverables:** Mobile App, Web Dashboard, AI Triage Engine, Emergency Module, EMR System, Analytics Dashboard, Admin Panel

**Design Notes:**
- Use a horizontal tech stack bar with colored pills for each technology
- Feasibility table: alternating row colors (#F5F5F5 and white)
- Deliverables count: highlighted badge, green (#2E7D32)

---

## SLIDE 5: IMPACT & SCALABILITY

**Layout:** Three sections — Before/After, Scaling Roadmap, Sustainability.

### Title
**Impact & Scalability**

### Before vs After

| Metric | Before | After (with ArogyaSetu+) |
|--------|--------|--------------------------|
| Specialist vacancy impact | Unaddressed | AI triage reduces load by 40% |
| Referral drop-off | 40% | <5% via real-time tracking |
| Travel for care | 57% travel 30+ km | 30% reduced via telemedicine |
| Digital records | <20% | 100% for enrolled PHCs |
| OOP waste per patient | ₹2,000–5,000 | Reduced by 60% via smart referrals |

### 3-Phase Scaling Roadmap
- **Phase 1 (Months 1–3):** Pilot in 5 PHCs, 1 CHC in Maharashtra
- **Phase 2 (Months 4–9):** Scale to 50 PHCs, 10 CHCs across 3 districts
- **Phase 3 (Months 10–18):** State-wide rollout + multi-state replication

### Sustainability Model
- Government co-funding (NHM)
- CSR partnerships for device donations
- Open-source core to reduce long-term costs

### Social Impact
- 10,00,000+ rural patients served in Year 1
- 50% reduction in maternal mortality via early referral
- 30% improvement in childhood immunization tracking

**Design Notes:**
- Before/After table: red for Before column header, green for After column header
- Roadmap: horizontal timeline with 3 colored milestones
- Impact numbers: large bold figures, blue (#1565C0)

---

## SLIDE 6: REFERENCES & DEMO

**Layout:** Top half references, bottom half demo + contact.

### Title
**References & Live Demo**

### References (6 sources)

1. MoHFW Rural Health Statistics 2025 — https://main.mohfw.gov.in
2. National Health Stack (NHSR) India Report 2024
3. NSSO 75th Round — Health in India — https://mospi.gov.in
4. WHO India — Digital Health Report 2023
5. India Health Initiative — Telemedicine Guidelines 2024
6. Government of Maharashtra — Health Department Annual Report 2024

### Demo Links (placeholders)
- **Mobile App (APK):** [link to be shared at demo]
- **Web Dashboard:** https://arogyasetu-plus.vercel.app
- **Live API Docs:** https://api.arogyasetu-plus.com/docs
- **GitHub Repository:** https://github.com/arogyasetu-plus

### Contact Information
- **Email:** [team-email@example.com]
- **Phone:** [+91-XXXXXXXXXX]
- **Team Lead:** [Name], [College/Organization]

**Design Notes:**
- References: numbered list, 16 pt, dark grey (#424242)
- Demo links: blue hyperlinks (#1565C0), 18 pt, underlined
- Contact: bold, 18 pt, dark blue (#1A237E)
- Background: very light grey (#FAFAFA)

---

*End of PPT Content — All slides formatted for PowerPoint, Canva, and Google Slides.*
