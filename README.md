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
