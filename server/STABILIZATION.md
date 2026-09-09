# Server Stabilization Contract

All changes are confined to `server/`. No frontend changes, credentials, provider
configuration, infrastructure provisioning, commits, or deployments are included.
This remains an unauthenticated demo server, not a production clinical system.
Caller-supplied patient/worker IDs and result values are not identity-verified or
clinically verified. Do not expose this server to untrusted networks or real PHI.

## Commands

From the repository root:

```sh
npm run typecheck --workspace=server
npm run build --workspace=server
npm test --workspace=server
npm run test:start --workspace=server
npm start --workspace=server
```

Build emits `server/dist/server.js`; `start` runs `node dist/server.js`.
`test:start` executes the configured start command's Node entry point with isolated
temporary stores, a loopback ephemeral port, no database, and no AI key. It checks
real HTTP health and the registered vitals route, then terminates its child.
Tests never use an external provider. Test files are executed by `tsx`, not included
in the production TypeScript build/typecheck.

`PORT` defaults to 3001 and must be an integer from 0 to 65535 (0 selects an ephemeral
port). `HOST` defaults to `0.0.0.0`; use `127.0.0.1` for local-only use.
`VITALS_MODE` defaults to `demo`, which needs no DB. Explicit `measured` mode still
requires a working `DATABASE_URL` and fails startup rather than silently storing
measured readings in memory. No environment file is automatically loaded.

`GET /` returns:

```json
{"status":"ok","name":"MediSync API","version":"1.0.0","mode":"demo","authentication":"unconfigured","abdm":"unconfigured","externalNotifications":"unconfigured"}
```

## Common Validation

Schemas below use `?` for optional fields and `T[]` for arrays. Objects are strict:
unknown fields are rejected, including nested objects. JSON numbers are not coerced
from strings. `null` is not an omitted optional field. All touched diagnostics,
referral, auth, ABDM and vitals endpoints reject unknown query parameters.
Prescription POST also rejects all query parameters.

`ID` is a trimmed string, 1-100 characters, matching `^[A-Za-z0-9_-]+$`.
`Text(N)` is a trimmed, nonempty string with at most N characters.
`ISO` is an ISO-8601 UTC datetime accepted by Zod `string().datetime()` (a `Z`
suffix is required; arbitrary offsets are not accepted).
String limits are JavaScript/Zod string lengths, while body limits are bytes.

Successful resource responses are `{success:true,data:T}`. Validation failures
return HTTP 400 `{success:false,error:"Invalid request",issues:ZodIssue[]}`
(Fastify parser/schema errors use `{success:false,error:string}`). Missing resources
return 404, invalid diagnostic transitions/duplicates and conflicting replay keys
return 409, oversized bodies return 413, and local store failures/capacity return
503. Unexpected failures return 500 without exposing internal details.

## Diagnostics

`GET /api/diagnostics/tests` takes no query and returns
`{success:true,data:{code:string,name:string,unit:string,normalRange:string}[]}`.
`normalRange` is catalogue metadata, not a result or a clinical interpretation.
The accepted codes are:

```text
malaria_rdt dengue_ns1 xcbx blood_sugar urinalysis cbc lft kft ecg troponin
usg_abdomen bp_monitor cbg oxygen_saturation wound_culture pt_inr blood_group
stool_reaction esr uric_acid mri_brain mri_spine dental_xray ear_swab tryptase
cbc_lft_kft cardiac_marker_panel temperature
```

`POST /api/diagnostics/orders`, body limit 16384 bytes, returns HTTP 201:

```ts
{
  patientId: ID;
  facilityId: ID; // must exist in the server facility catalogue
  triageId?: ID;
  referralId?: ID;
  tests: TestCode[]; // 1-28, unique, all in the catalogue above
  priority?: 'ROUTINE' | 'URGENT' | 'STAT'; // default ROUTINE
  orderedBy: Text(100);
  notes?: Text(2000);
}
```

`GET /api/diagnostics/orders` accepts only optional `patientId:ID`, `facilityId:ID`,
and `status:DiagnosticStatus` query parameters. Filters intersect. Returns an array
sorted newest first. `GET /api/diagnostics/orders/:id` accepts `id:ID`, no query,
and returns one order or 404.

```ts
type DiagnosticStatus = 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' |
  'COMPLETED' | 'CANCELLED';
type DiagnosticOrder = {
  id: string; patientId: string; patientName: string;
  facilityId: string; facilityName: string; triageId?: string; referralId?: string;
  tests: string[]; priority: 'ROUTINE' | 'URGENT' | 'STAT';
  status: DiagnosticStatus; orderedBy: string; results: TestResult[];
  notes?: string; createdAt: ISO; completedAt?: ISO;
};
type TestResult = {
  id: string; testName: string; testCode: string; value: string; unit: string;
  flag: 'NORMAL' | 'ABNORMAL' | 'CRITICAL'; referenceRange?: string;
};
```

`PATCH /api/diagnostics/orders/:id/status`, body limit 1024 bytes:

```ts
{ status: DiagnosticStatus }
```

Allowed forward transitions: `ORDERED -> SAMPLE_COLLECTED -> IN_PROGRESS -> COMPLETED`.
Any nonterminal state may transition to `CANCELLED`. Same-state retries return the
unchanged record. Terminal states cannot reopen. Completion requires exactly one
nonempty, valid result per ordered code, with no duplicates or unordered results.
Status updates never generate results. The API no longer auto-seeds fake completed
orders on boot.

`PATCH /api/diagnostics/orders/:id/result`, body limit 4096 bytes:

```ts
{
  testCode: TestCode; // must be ordered and not already have a result
  value: Text(2000);
  unit: string; // trimmed, 0-50 characters (empty allowed for qualitative tests)
  flag: 'NORMAL' | 'ABNORMAL' | 'CRITICAL'; // explicitly supplied, never defaulted
  referenceRange?: Text(200);
}
```

Only `SAMPLE_COLLECTED`/`IN_PROGRESS` accepts results. A partial result moves the
order to `IN_PROGRESS`; the last required result automatically completes it and
sets `completedAt`. A single-test order can therefore complete on its first result
after collection. Duplicate results return 409 rather than append or overwrite.
`Not yet added`, `pending`, `NA`, and `N/A` (case-insensitive) are rejected as values.
The server cannot verify whether a supplied laboratory result is genuine; it never
invents one or infers a NORMAL flag. Reference range defaults to catalogue metadata
only when omitted.

## Referrals

`POST /api/referrals`, body limit 16384 bytes, preserves HTTP 200:

```ts
{
  patientId: ID;
  fromFacilityId: ID; // must exist, no fallback to an unrelated facility
  symptoms: Text(100)[]; // 1-50, unique
  patientAge: number; // integer 0-120
  patientGender: 'MALE' | 'FEMALE' | 'OTHER';
  vitalSigns?: {
    temperature?: number; // 25-45 C
    heartRate?: number; // 20-300 bpm
    bloodPressureSystolic?: number; // 40-300 mmHg
    bloodPressureDiastolic?: number; // 20-200 mmHg
    oxygenSaturation?: number; // 50-100 percent
    respiratoryRate?: number; // 1-100 per minute
  }; // nonempty if supplied; BP must be a pair with systolic > diastolic
  reason?: Text(2000);
}
```

The existing triage/routing/optional configured-AI behavior is preserved. Unknown
symptom text is allowed as before, but bounded; diagnostic test codes are not.

```ts
type ReferralStatus = 'CREATED' | 'ACCEPTED' | 'IN_TRANSIT' | 'ARRIVED' |
  'COMPLETED' | 'DROPPED';
type Referral = {
  id: string; patientId: string; fromFacilityId: string; toFacilityId: string;
  severity: 'RED' | 'YELLOW' | 'GREEN'; status: ReferralStatus; reason: string;
  aiTriageSummary: string; qrCode: string; createdAt: ISO; updatedAt: ISO;
  toFacility: {
    id: string; name: string;
    type: 'SUB_CENTRE' | 'PHC' | 'CHC' | 'DISTRICT_HOSPITAL';
    latitude: number; longitude: number; district: string; taluka: string;
    beds: {total:number; available:number; occupied:number};
    medicineAvailability: number; specialists: string[]; contactPhone: string;
    isActive: boolean;
  };
  distanceKm: number; routingReason: string;
};
```

Routing fields are now retained with the durable record. `GET /api/referrals/:id`
takes `id:ID`, no query, and returns one record. `GET /api/referrals` accepts only
optional `status:ReferralStatus` and returns an array. `GET /api/referrals/active`
takes no query, excludes COMPLETED/DROPPED, and sorts by severity.
`PATCH /api/referrals/:id/status` takes `{status:ReferralStatus}`, body limit 1024.
It validates enum values and persists updates; no new referral transition policy
was introduced, preserving existing behavior.

## POST/PATCH Replay Protection

Applies to `POST /api/diagnostics/orders`, `POST /api/referrals`,
`PATCH /api/diagnostics/orders/:id/result`, and
`PATCH /api/diagnostics/orders/:id/status`.

```http
Idempotency-Key: client-generated-stable-action-id
```

Optional for compatibility with existing direct callers. If supplied, it is 1-128
characters matching `^[A-Za-z0-9._:-]+$`; empty/malformed/combined duplicate headers
are rejected. Omission is NOT replay-protected: POST creates a fresh resource each
time, while PATCH applies the ordinary state/duplicate checks. Use one stable key
per queued action, not per retry.

Keys are scoped by store, not by authenticated user (auth is unconfigured).
All three diagnostic write endpoints share one key namespace. Each PATCH receipt
binds the key to its method, order ID, operation (`result` or `status`), and validated
body. Reusing a key for a different order, operation, or valid body returns 409;
reusing a diagnostic POST key for PATCH (or vice versa) also returns 409. Existing
POST receipts retain their original format and remain replayable.
Same key and same validated, normalized body returns the original success status
and body, even if the resource has since changed. Object key order and omitted
default ROUTINE do not matter; array order does. A changed valid body returns 409.
Concurrent matching requests wait for the first operation; a conflicting in-flight
request returns 409. Responses include `Idempotency-Replayed: true|false`.
Failed operations do not consume a key.

Both PATCH endpoints return HTTP 200 `{success:true,data:DiagnosticOrder}` and
`Idempotency-Replayed: false` on the initial success, `true` on identical replay.
The original response snapshot is replayed, NOT the current order. This works even
after completion: replaying an earlier SAMPLE_COLLECTED status or partial result
does not roll back the completed order, append a duplicate, or rerun state checks.
Fetch the order separately for current state. Payload validation still precedes
receipt lookup; malformed requests return 400. Requests without a key retain the
existing duplicate-result and transition rules and cannot safely replay old PATCHes.
The request schemas and 4096-byte result / 1024-byte status limits are unchanged.

Mutation and receipt commit in one file rename. Read/modify/write runs without
yielding, preventing lost updates from concurrent PATCHes in the supported single
process. Write failure returns 503 with neither mutation nor receipt committed;
retrying the same key can then succeed. PATCH receipts share the existing 10000-key
and 32 MiB diagnostic store limits with POST receipts and persist across restarts.

Entity and replay response are written atomically in the same JSON file using
temporary-file rename, following the existing teleconsult file pattern. Successful
writes survive process restart. Default files are `server/data/diagnostics.json`
and `server/data/referrals.json`, independent of the startup working directory.
Override with `DIAGNOSTICS_STORE_PATH` and `REFERRALS_STORE_PATH`. Files are ignored
by Git and created with mode 0600 where the OS supports POSIX modes.

Each store allows at most 10000 records, 10000 replay keys, and 32 MiB serialized
JSON. Keys do not expire and are not silently evicted. Capacity or write/read errors
return 503 rather than acknowledge a lost write. Keep these files across restarts.
This is SINGLE-PROCESS local persistence, not a shared multi-worker database, an
encrypted medical-record store, or a power-loss/fsync guarantee. Do not run multiple
server writers against the same file. Reads return full arrays, bounded by store
capacity; pagination was not added.

The mobile sync implementation inspected during this task simulated requests.
No frontend file was edited. Server support alone cannot make a frontend send a
header; end-to-end sync must use the stable queued-action ID as `Idempotency-Key`.

## Triage Ordering

`POST /api/triage` continues returning `recommendedDiagnostics` for clinician review
but no longer creates diagnostic orders, even when `patientId` is supplied. The
implicit `autoOrderDiagnostics` call/helper and hardcoded facility/worker ordering
were removed. An explicit reviewed `POST /api/diagnostics/orders` is required.

## Auth And ABDM

Authentication is unconfigured, not mock-authenticated. No JWT/user/transaction ID
is fabricated. No OTP is sent or verified. Well-formed requests below return 503;
malformed requests return 400. Body limits are 1024 bytes.

```ts
// POST /api/auth/login
{ phone: string } // ^(?:\+91)?[6-9][0-9]{9}$
// Response
{ success:false, error:'Authentication provider unconfigured; no OTP sent',
  mode:'unconfigured', delivered:false }

// POST /api/auth/verify-otp
{ phone: string; otp: string } // same phone rule; OTP ^[0-9]{6}$
// Response
{ success:false, error:'Authentication provider unconfigured; identity not verified',
  mode:'unconfigured', verified:false }
```

`ABHA` matches `^(?:[0-9]{14}|[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4})$`.
`POST /api/abdm/verify/:abhaId` and `POST /api/abdm/generate-otp/:abhaId`
take `abhaId:ABHA` and no body (or `{}`). Verification returns:

```ts
{ success:false, error:string, data: {
  valid:false, abhaId:string, formatValid:true, verified:false,
  mode:'unconfigured', message:string
} }
```

The format check is not identity verification. No demographics are fabricated.
OTP generation returns `{success:false,error:string,data:{success:false,
mode:'unconfigured',delivered:false,message:string}}` without a transaction ID.
`POST /api/abdm/verify-otp` accepts `{txnId:ID,otp:string}` with six numeric OTP
digits and returns `{success:false,error:string,data:{success:false,
mode:'unconfigured',verified:false,message:string}}`.

Local consent simulation is retained, explicitly non-binding:

```ts
// POST /api/abdm/consent (8192-byte body)
{
  patientAbhaId: ABHA; patientName: Text(160);
  requesterId: ID; requesterName: Text(160); purpose: Text(500);
  dataRequested: Text(100)[]; // 1-20, unique
  validFrom: ISO; validTo: ISO; // validTo > validFrom
}
type ConsentStatus = 'REQUESTED' | 'GRANTED' | 'DENIED' | 'EXPIRED' | 'REVOKED';
// Response data = request fields plus:
{ id:string; status:'REQUESTED'; createdAt:ISO; mode:'demo'; legallyValid:false }
```

`GET /api/abdm/consent/:id` takes `id:ID`; missing consent is 404.
`GET /api/abdm/consents/:abhaId` takes `ABHA` and returns a matching array.
`PATCH /api/abdm/consent/:id/status` takes `{status:ConsentStatus}`, 1024-byte body.
All return the demo metadata even when status is GRANTED. They do not create real
ABDM consent, verify a consenting identity, or authorize real data access. Records
are in-memory and do not automatically expire; production consent is unconfigured.

## Notifications

No new HTTP notification endpoint was added. Existing `sendSMS` and
`sendPushNotification` return `{success:false,channel:'SMS'|'PUSH',
mode:'unconfigured',delivered:false,error:string}` with no provider/message ID.
Patient messages and phone numbers are no longer logged by these stubs.
WebSocket broadcast remains local and returns `{success:true,channel:'WebSocket',
status:'broadcast_attempted',deliveryConfirmed:false}`; it is not a delivery receipt.
Emergency dispatch reports `{mode:'demo',channels:['WebSocket'],
unconfiguredChannels:['PUSH','SMS'],deliveryConfirmed:false,recipientCount:0,
intendedRecipientCount:number,timestamp:ISO}`. Fabricated district-officer delivery
and the hardcoded officer SMS recipient were removed.

## Vitals

`POST /api/emergencies/:id/vitals`, `id:ID`, body limit 2048 bytes:

```ts
{
  source: 'demo' | 'measured'; measuredAt: ISO;
  heartRate?: number; // 20-300
  oxygenSaturation?: number; // 50-100
  bloodPressureSystolic?: number; // 40-300
  bloodPressureDiastolic?: number; // 20-200
}
```

Requires at least one measurement. BP must be a pair with systolic > diastolic.
`measuredAt` must be within the past five minutes and at most 30 seconds in the
future. Emergency must exist and be IN_TRANSIT/EN_ROUTE_TO_HOSPITAL. Demo mode
requires `source:'demo'` and `X-Demo-Mode: true`; measured mode requires
`source:'measured'` and an absent or `false` header. Other header values return 400.
Success is HTTP 201 `{success:true,data:StoredVital,mode:'demo'|'measured'}` where
`StoredVital` is the request plus `{id:string,emergencyId:string,receivedAt:ISO}`.

`GET /api/emergencies/:id/vitals` accepts only optional query `limit`, a decimal
integer string 1-120 without leading zeros (default 120), and the same mode header.
Returns `{success:true,data:StoredVital[],mode:'demo'|'measured',retention:120}` in
chronological order. Demo retains 120 readings per emergency and 100 emergency
histories in memory; new histories evict the oldest map entry. Demo data is not
broadcast to clinical WebSocket channels. Measured history uses the existing PG
implementation, retains 120 per emergency, and was not tested against live PG.
Wrong mode returns 403, wrong transit status 409, simultaneous saves for the same
emergency 429, and unavailable measured storage 503. History requires an existing
emergency but not transit status. Vitals are not POST-idempotent.

## Prescription Type Fix

Shared server types now contain `DoctorAvailability`, `Prescription`, and
`PrescriptionMedication`; `TeleconsultSession.prescription` is optional. Removed
the stale nonexistent `seedDemoSessions` import/call rather than inventing sessions.
The existing prescription persistence remains in the teleconsult store.

`POST /api/teleconsult/prescriptions`, body limit 16384 bytes, HTTP 201:

```ts
{
  sessionId: ID; patientId: ID; doctorId: ID;
  medications: { name:Text(160); dosage:Text(160); frequency:Text(160);
    duration:Text(160); instructions?:Text(500) }[]; // 1-20
  notes?: Text(500);
}
// Response data = request plus {id:string,createdAt:ISO}
```

The session must exist. This remains an unauthenticated demo workflow, not a signed
or identity-verified prescription. Other teleconsult business behavior is unchanged.

## Verification Coverage

The server test suite covers no-DB boot, all 25 diagnostic status pairs, missing and
duplicate/unordered/placeholder results, catalogue-to-triage consistency, strict
request validation, intersecting list filters, concurrent POST replays/conflicts,
original response replay after status changes, separate-process restart persistence
for both resources and keys, failed writes and retry recovery, in-flight conflicts,
diagnostic PATCH replay after completion, operation/order/payload key conflicts,
atomic mutation/receipt failure recovery, concurrent distinct result updates,
triage recommendations without implicit orders,
honest auth/ABDM/notification behavior, consent validation, vitals modes/ranges/time/
transit, measured-without-DB refusal, and prescription persistence/validation.

Live PostgreSQL, real auth/ABDM/SMS/push delivery, browser sync and multi-process
shared-store use are not verified or claimed.
