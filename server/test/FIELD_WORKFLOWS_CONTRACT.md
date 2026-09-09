# Field Workflow Integration

## Main-Owned Wiring

- Register default `routes/fieldWorkflows.ts` on the main Fastify server. It uses absolute `/api/field-workflows` paths; do not add a prefix.
- Add `UPDATE_INVENTORY_ORDER` to both the sync action union and persisted-action whitelist.
- Replay `CREATE_ASHA_VISIT`, `UPDATE_INVENTORY`, `DISPENSE_MEDICINE`, `CREATE_INVENTORY_ORDER`, and `UPDATE_INVENTORY_ORDER` as `POST /api/field-workflows/actions`, with JSON `{ id: action.id, type: action.type, payload: action.payload }` and `Idempotency-Key: action.id`.
- All screen writes already await local enqueue, not a direct network mutation. Only the sync service's real acknowledgment may mark them synced.
- `400`/`422` rejections can be discarded in the queue while retaining original audit data; users then enter a corrected action with a new ID. Network errors, `409`, and `503` must retain the original key and remain retryable/reviewable.

## Patient Owner

The default route validates patient existence through `patientRepository.get`. The current repository has no schedule update method. Supply plugin option `projectPatientVisit(projection)` once available:

```ts
type PatientVisitProjection = {
  patientId: string;
  trimester: 1 | 2 | 3;
  lastVisit: string; // YYYY-MM-DD
  nextVisitDate?: string; // explicitly entered by ASHA, never invented
};
```

Make this repository update idempotent and chronological. Missing `nextVisitDate` should clear the now-completed due date or explicitly mark the next schedule unknown, not silently retain a past due visit. Never overwrite a newer patient schedule with an older projection. The field service projects its latest recorded visit after commit, on POST replay, and on GET visits. A projection failure does not erase a durable visit: acknowledgment explicitly returns `patientProjection: 'pending'`. No cross-file atomicity or background reconciliation is claimed. Tests inject an isolated projection callback and patient lookup.

## HTTP Contract

`POST /api/field-workflows/actions` requires matching action ID and idempotency key. IDs use `[A-Za-z0-9_-]`, maximum 100 characters. Body limit is 16 KiB. Success is `200 { success: true, replayed, data: { id, type, entityId, patientProjection?, notificationsSent: false } }`; header `Idempotency-Replayed` is also set. Same key with changed valid content returns `409`. Definite validation/state rejection is `400`; file/capacity failure is `503` without acknowledgment.

Inventory create/count/dispense payloads share `{ facilityId, medicineId, staffId, quantity, timestamp }`. Optional `medicineName` is display metadata. `timestamp` is ISO datetime with timezone; future timestamps beyond five minutes are rejected. All quantities are safe integers.

- `DISPENSE_MEDICINE`: nonnegative quantity at most current stock; optional `dispensedBy`.
- `UPDATE_INVENTORY`: additionally `newStock`, `operation: 'physical_count'`, optional `currentStock`; supplied count fields must match quantity and not exceed capacity.
- `CREATE_INVENTORY_ORDER`: positive quantity at most medicine capacity, `status: 'PO'`, optional `orderedBy`. Order ID is action ID.
- `UPDATE_INVENTORY_ORDER`: `{ facilityId, orderId, staffId, timestamp, status }`. Required sequence: `PO > APPROVED > ORDERED > RECEIVED > VERIFIED > STOCKED`. Only final transition adds stock, rejects capacity overflow, and never increments again under another key.
- `CREATE_ASHA_VISIT`: `{ patientId, ashaId, trimester, checklist, reviewed: true, highRisk, highRiskFlags, requiresClinicianReview, timestamp, voiceNotes?, nextVisitDate? }`. Checklist strings: `bp`, `weight`, `hb`, `fundalHeight`, `urineAlbumin`, `hivSyphilis`, `presentation`; booleans: `tt1`, `tt2`, `ifa`, `ttBooster`. Blank measurements are omitted observations. Numeric validation: BP systolic 50-300, diastolic 30-200, systolic greater than diastolic; weight 1-500; Hb 1-25; fundal height 1-60. Text observations max 200 chars; notes max 4000. Review flags must match `hbReview` for Hb <11, `bpReview` for BP >=140 systolic or >=90 diastolic, and `presentationReview` for any supplied presentation. These are review prompts, not diagnoses; no automatic referral or notification is created.

`GET /api/field-workflows/inventory?facilityId=...` returns `{ success: true, data: { stocks, log, orders, usage, mode, notificationsSent: false } }`. `stocks` uses the existing medicine catalogue shape. Log entries retain before/after counts, quantity, staff, operation, occurrence and recording times. Usage reports `total7`, `total30`, `dailyAverage7`, `dailyAverage30` per medicine, exclusively from committed dispense logs within trailing windows. Pending mobile actions, seed counts, physical counts and stocking are not usage. Unknown/unseeded facility returns an explicit empty catalogue.

`GET /api/field-workflows/visits?patientId=...` returns `{ success: true, data: { visits, patientProjection } }`.

## Storage And Limits

- One `FileStore<FieldRecord>` owns inventory catalogue, logs, orders, and action receipts; no second stock store. The old `getInventory` reads the same store, and legacy physical counts now retain an audit entry.
- `FIELD_WORKFLOWS_STORE_PATH` overrides the default server `data/field-workflows.json` file. Only one process may own a file. Existing atomic rename semantics cover application process restarts, not power-loss/fsync guarantees or multi-process writers.
- Default generation is off. A manual server-side `setInventory(facilityId, items)` seeds an uninitialized catalogue once and will not overwrite existing stock/history. No public seed API was added.
- `FIELD_WORKFLOWS_DEMO=true` explicitly enables synthetic catalogue generation and defaults to a separate `field-workflows-demo.json`. Never configure a shared live/demo override path. Simulator stock writes are ignored outside isolated demo mode.
- Existing store limits are 10,000 records, 10,000 replay receipts, 32 MiB serialized file. Receipts include aggregate snapshots, so the byte limit may arrive earlier. Capacity returns `503`; history/keys are never silently pruned. No pagination or archival is implemented.
- Screen role checks are preserved (ASHA and PHARMACIST), but this is not server authentication/authorization. Staff IDs remain client assertions. Do not expose these routes as a production authenticated medical system without the main auth integration.
- Shared navigation, persona logic, sync implementation, API module, translation JSON and patient repository were not edited. New feature labels use an English dictionary fallback pending Hindi/Marathi localization.

## Verification

- `npx tsx --test test/field-workflows.test.ts` from `server`: real Fastify injection, isolated files, concurrent same/different keys, capacity, complete PO sequence, numeric and review validation, 7/30-day usage, projection failure/retry, write rollback and separate-process restart replay.
- `node --test apps/mobile/src/screens/fieldScreenSupport.test.cjs apps/mobile/tests/field-client.test.cjs`: screen queue/role/storage-failure contracts and strict field client envelopes. These use a small React harness, not a native device/browser run.
- Full mobile typecheck requires main's new outbox union plus unrelated concurrent patient/demo integration to finish.
