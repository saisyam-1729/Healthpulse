# Architecture — Before the Diffusion Component

This reflects the repository exactly as cloned, before any of this
project's changes (see [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md) for
the full narrative version of this diagram).

```mermaid
flowchart TD
    subgraph Firmware["ESP32 firmware"]
        BLE["esp32_ble_firmware\nBLE notify, ~1s"]
        WIFI["esp32_health_monitor\nHTTP POST, ~5s"]
    end

    subgraph FE["Frontend (Vercel) — src/"]
        DASH["Dashboard.tsx\ncloud poll (5s) + local LAN poll + BLE push"]
    end

    subgraph BE["Backend (Render) — backend/"]
        EXPRESS["Express server.js"]
        MONGO[("MongoDB — HealthData\n{userId, deviceId, heartRate, spo2, temperature, createdAt}")]
        RULES["ruleEngine.js / healthEngine.js\nhand-written thresholds"]
    end

    subgraph AI["ai_service/ (Flask, port 5002)"]
        FLASK["scikit-learn ensemble\n(disease classification,\nsynthetic training data)"]
    end

    BLE -->|"synced via frontend"| DASH
    WIFI -->|"POST /api/device/data"| EXPRESS
    DASH -->|"POST /api/device/data"| EXPRESS
    EXPRESS --> MONGO
    EXPRESS --> RULES
    EXPRESS -.->|"axios call, port mismatch\n5001 default vs actual 5002"| FLASK
    MONGO --> EXPRESS --> DASH
```

**Characteristics:**
- No time-series ML component of any kind exists.
- "Stress" is computed by hand-written heuristics in two places
  (`src/lib/stress.ts` on the frontend, `backend/services/predictionService.js`
  on the backend) — neither is a trained model.
- The only trained ML artifacts (`ai_service/models/*.joblib`) solve an
  unrelated problem (lab-value disease classification) and were trained
  entirely on synthetic data generated with `np.random.normal`.
- The Node↔Flask integration has a live port-mismatch bug
  (`AI_SERVICE_URL` defaults to 5001; Flask listens on 5002), so in most
  deployments the call silently fails and falls back.
- No forecasting, imputation, generation, or anomaly-scoring capability
  exists anywhere in the system.

See [ARCHITECTURE_AFTER.md](ARCHITECTURE_AFTER.md) for what changed.
