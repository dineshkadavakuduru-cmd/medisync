# MediSync (मेडीसिंक)

MediSync is a comprehensive telehealth and patient management platform connecting ASHA workers, doctors, and patients across rural India, starting with Pune district.

## One-line Description

A full-stack healthcare platform for patient management, AI-powered triage, referral routing, real-time alerts, and analytics.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Mobile App │────▶│   Server    │────▶│ PostgreSQL  │
│  (Expo)     │     │ (Fastify)   │     │  + PostGIS  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                            │
┌─────────────┐     ┌──────┴──────┐     ┌─────────────┐
│  Web App    │────▶│ ML Service  │     │  WebSocket  │
│  (Next.js)  │     │ (FastAPI)   │     │   Alerts    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Mobile | Expo / React Native |
| Web | Next.js / React |
| Server | Node.js / Fastify / TypeScript |
| Database | PostgreSQL + PostGIS |
| ML Service | Python / FastAPI / Pydantic |
| Auth | Mock JWT |

## Prerequisites

- Node.js >= 20.0.0
- Python 3.10+
- PostgreSQL 15+

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Start PostgreSQL

Ensure PostgreSQL is running with PostGIS extension enabled.

### 3. Start Server

```bash
cd server
npm install
npm run dev
```

Server runs on http://localhost:3001

### 4. Start ML Service

```bash
cd ml
pip install -r requirements.txt
uvicorn api.main:app --port 8000
```

ML service runs on http://localhost:8000

### 5. Start Mobile App

```bash
cd apps/mobile
npm install
npx expo start
```

### 6. Start Web App

```bash
cd apps/web
npm install
npm run dev
```

Web app runs on http://localhost:3000

### Deploy the Bottom-Tab App to Vercel

The phone-style MediSync UI is `apps/mobile`, not the separate Next.js district
dashboard in `apps/web`. For the phone-style production site, use:

- Root Directory: repository root (leave blank, not `apps/web`).
- Framework Preset: Other.
- Build Command: `npm run build --workspace=apps/mobile`.
- Output Directory: `apps/mobile/dist`.
- Install Command: `npm ci` from the repository root.

The root `vercel.json` selects this static Expo web export. Clear conflicting
dashboard overrides in Vercel and create a new deployment after changing the
settings; an existing deployment will not change when local files change.
Deploy `apps/web` as a separate Next.js project if the district dashboard is also
needed. Its build output is `.next`, not the mobile export.

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_ML_URL` to public HTTPS services before
building if live data is required. Without reachable services, the mobile app's
existing fallback displays sample data, not live healthcare records.

## Environment Variables

### Server (.env)

```
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/medisync
```

### Mobile (.env)

```
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_ML_URL=http://localhost:8000
```

### Web (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ML_URL=http://localhost:8000
```

## Scripts

```bash
# Install all workspace dependencies
npm run install:all

# Start all services
npm run dev:server
npm run dev:web
npm run dev:mobile

# Build
npm run build:all

# Lint
npm run lint:all
```

## Team

MediSync Development Team
