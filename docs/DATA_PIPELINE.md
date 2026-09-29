# HealthPulse — Physiological Data Pipeline

**Status:** Phase 3 deliverable. All findings are grounded in
`backend/models/HealthData.js`, `backend/routes/deviceRoutes.js`,
`backend/controllers/healthDataController.js`,
`esp32_ble_firmware/esp32_ble_firmware.ino`, and
`esp32_health_monitor/esp32_health_monitor.ino`. No field below is invented;
where a property (e.g., exact real-world sampling jitter) cannot be
determined from source code alone, that is stated explicitly.

---

## 1. What the system actually stores

A single collection, `HealthData` (Mongoose schema, `backend/models/HealthData.js`):

```js
{
  userId:      ObjectId,   // ref 'User', required
  deviceId:    String,     // optional
  heartRate:   Number,     // required
  spo2:        Number,     // required
  temperature: Number,     // required
  createdAt:   Date        // default Date.now (also duplicated by { timestamps: true })
}
```

Indexed on `{ userId: 1, createdAt: -1 }`.

**This confirms the data is effectively:**

```
userId | deviceId | heartRate | spo2 | temperature | createdAt
```

i.e. exactly the simple `timestamp | heart_rate | spo2 | temperature` shape
hypothesized in the task brief — **3 physiological channels + a timestamp**,
scoped per user and (loosely) per device. There is no separate "session"
identifier; a session in practice is an unbroken run of `HealthData`
documents for a given `userId`+`deviceId` without a large time gap — the
system does not model this explicitly anywhere in code.

**Storage pattern:** one document per reading (true time series, not
aggregated/batched). Every `POST /api/device/data` request inserts exactly
one document (`deviceRoutes.js`). There is no rollup, bucketing, or
downsampling logic anywhere in `backend/`.

## 2. Ingestion path (source of truth for sampling behavior)

```
MAX30102 (PPG) + DS18B20 (temp)
        │
        ├── esp32_ble_firmware:  BLE JSON notify every ~1000 ms  ──► frontend (Web Bluetooth) ──► POST /api/device/data
        │
        └── esp32_health_monitor: HTTP POST every 5000 ms (SEND_INTERVAL_MS) ──► POST /api/device/data directly
                                                                                          │
                                                                                          ▼
                                                                              insert one HealthData doc
```

- `POST /api/device/data` (`backend/routes/deviceRoutes.js`) validates
  ranges (HR 30–220, SpO2 0–100, Temp 30–45°C) before insert. Out-of-range
  values are rejected at the API boundary, not stored as-is.
- Reads (`GET /api/health`, `GET /api/device/:userId`) return the **last 20
  documents**, sorted `createdAt desc` then reversed for chronological
  display. There is no query parameter for a custom time range or limit.

## 3. Sampling frequency

**Not a single fixed value — it depends on which firmware produced the
reading:**

| Source | Nominal interval | Where defined |
|---|---|---|
| `esp32_ble_firmware` (BLE → frontend → backend) | ~1000 ms | `esp32_ble_firmware.ino`, `millis() - lastBLEUpdate > 1000` |
| `esp32_health_monitor` (WiFi → backend directly) | 5000 ms | `esp32_health_monitor.ino`, `#define SEND_INTERVAL_MS 5000` |
| Frontend cloud-poll fallback (reads, not writes) | 5000 ms | `Dashboard.tsx`, `setInterval(fetchData, 5000)` |

Because a user's device could be either firmware, and because the BLE path
additionally depends on the frontend tab staying open and successfully
relaying data to the backend, **the effective sampling interval for any
given stored series is irregular and must be treated as such by any model**
— it cannot assume a fixed Δt.

## 4. Timestamp representation

`createdAt: Date` (MongoDB ISODate / BSON date, millisecond precision),
assigned server-side at insert time (`Date.now` default) — **not** the
device's on-board clock. This means:
- Timestamps reflect network/server arrival time, not sensor sample time.
- Any latency between sensor read and successful POST (retry, WiFi
  reconnect, BLE relay through an open browser tab) shows up as jitter in
  the stored interval, not as a corrected sample time.

## 5. Missing values

Missingness is real and explicit in the source data, at the firmware level:

- `esp32_health_monitor.ino`: fields are sent as JSON `null` when a reading
  is invalid, and a POST is only attempted when
  `fingerPresent && (HR valid || SpO2 valid)` — meaning **entire POST
  cycles can be skipped**, producing gaps in the stored series, not just
  null-valued documents.
- `esp32_ble_firmware.ino`: exposes an explicit `fingerPresent: false` flag
  in its JSON payload; downstream consumers must interpret readings
  received while `fingerPresent=false` as unreliable/synthetic-looking
  (the PPG algorithm will output *something* even without a finger present,
  but it isn't physiological).
- The backend's `POST /api/device/data` validator (30–220 bpm, 0–100%,
  30–45°C) will reject clearly invalid values outright — so what reaches
  `HealthData` is a mix of "no reading was sent at all" (a timestamp gap)
  and "a plausible-looking but not necessarily reliable reading was
  stored" (no `fingerPresent` flag is persisted to `HealthData` today).

**Consequence for the ML pipeline:** the two failure modes — irregular
sampling and missing/gappy readings — are the same underlying phenomenon
(device not producing valid data) but are not distinguished in the stored
schema. A future ingestion improvement (storing `fingerPresent`/validity
alongside each reading) would materially improve training-data quality;
absent that, the ML pipeline must infer missingness from timestamp gaps
alone when working with historical `HealthData` records.

## 6. Sequence length / windowing (as currently used downstream)

The only place the app currently defines a "window" is client-side and
cosmetic: `Dashboard.tsx` keeps the **last 20 readings** in a React state
array (`prev.slice(-19)` push pattern) to feed `recharts`. This is not a
principled ML window — it is however a useful anchor: **at 5s cadence, 20
points ≈ 100 seconds of context; at 1s cadence, 20 points ≈ 20 seconds.**
Any diffusion context/prediction length chosen later should be configurable
rather than hardcoded to this UI convention (see MODEL_SELECTION.md and the
windowing requirements in the implementation plan).

## 7. Channels / dimensionality

3 numeric channels per timestamp: `heartRate` (bpm), `spo2` (%),
`temperature` (°C). No other physiological channel is persisted in
`HealthData`. (`BLEHealthData` on the frontend additionally carries
`stressScore`, `stressLevel`, `rmssd` computed on-device by the BLE
firmware, but **these are not written to `HealthData`** — they exist only
transiently in the browser and are not part of the durable time series
today.)

## 8. Normalization / units

- `heartRate`: beats per minute, integer-like float, plausible physiological
  range enforced at ingestion: 30–220.
- `spo2`: percent, 0–100.
- `temperature`: Celsius, 30–45.
- No normalization/standardization is applied anywhere before storage —
  values are stored in raw physical units. Any normalization must be
  introduced by the new ML pipeline itself (fit on a training split only —
  see the leakage-prevention requirement in the implementation plan).

## 9. Patient/session identifiers

- `userId` (ObjectId) — the only durable per-patient identifier tying
  readings together over time.
- `deviceId` (String, optional) — identifies the physical sensor, useful
  for detecting firmware-variant-driven sampling-rate differences, but not
  reliably present on every document (schema marks it optional).
- **No session identifier exists.** A "session" (continuous wear period)
  must be inferred post-hoc from timestamp gaps if needed (e.g., a gap
  larger than some threshold, such as 60s, splits two sessions) — this is
  an analysis-time construct, not a stored field.

## 10. Example synthetic schema (non-sensitive, for documentation only)

```json
[
  { "userId": "665f1a2b3c4d5e6f7a8b9c0d", "deviceId": "ESP32-HEALTH-001", "heartRate": 74, "spo2": 98, "temperature": 36.6, "createdAt": "2026-09-24T08:00:00.000Z" },
  { "userId": "665f1a2b3c4d5e6f7a8b9c0d", "deviceId": "ESP32-HEALTH-001", "heartRate": 76, "spo2": 97, "temperature": 36.6, "createdAt": "2026-09-24T08:00:05.100Z" },
  { "userId": "665f1a2b3c4d5e6f7a8b9c0d", "deviceId": "ESP32-HEALTH-001", "heartRate": null, "spo2": null, "temperature": null, "createdAt": "2026-09-24T08:00:47.900Z" },
  { "userId": "665f1a2b3c4d5e6f7a8b9c0d", "deviceId": "ESP32-HEALTH-001", "heartRate": 80, "spo2": 96, "temperature": 36.7, "createdAt": "2026-09-24T08:01:05.400Z" }
]
```

This example is synthetic and illustrative only — it demonstrates the real
schema shape and the gap/missingness pattern discovered in code (a 42.8s gap
followed by resumed 5s-cadence readings, consistent with the WiFi firmware
briefly losing a valid finger-present reading), not real patient data.

## 11. Summary of constraints that drive model design

| Constraint | Finding | Implication |
|---|---|---|
| Channels | 3 (HR, SpO2, Temp) | Low-dimensional multivariate series |
| Sampling | Irregular, firmware-dependent (1s or 5s nominal, real jitter from network/BLE relay) | Model must condition on actual elapsed time, not assume fixed Δt |
| Missingness | Real, both as timestamp gaps and (in firmware payloads, not yet persisted) explicit null/invalid flags | A conditioning-mask-based approach is a natural fit |
| Sequence length | No principled server-side window; UI convention is 20 points | Context/prediction length must be configurable, not hardcoded |
| Identifiers | `userId` + optional `deviceId`, no session ID | Windows should be built per (`userId`,`deviceId`) with gap-based session splitting |
| Ground truth for stress | None — only heuristic scores exist | Stress-conditional generation is not well-grounded without new labels; treat as future work, not a primary task (see MODEL_SELECTION.md) |
| Available real training data | None gathered/exported for this task | Development and smoke-testing must use the synthetic generator (Phase 34); do not fabricate benchmark results against data that doesn't exist |
