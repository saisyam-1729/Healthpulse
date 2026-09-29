# Architecture — After the Diffusion Component

```mermaid
flowchart TD
    subgraph Firmware["ESP32 firmware (unchanged)"]
        BLE["esp32_ble_firmware\nBLE notify, ~1s"]
        WIFI["esp32_health_monitor\nHTTP POST, ~5s"]
    end

    subgraph FE["Frontend (Vercel) — src/ (unchanged in this phase)"]
        DASH["Dashboard.tsx\ncloud poll + local LAN poll + BLE push"]
    end

    subgraph BE["Backend (Render) — backend/ (unchanged)"]
        EXPRESS["Express server.js"]
        MONGO[("MongoDB — HealthData")]
        RULES["ruleEngine.js / healthEngine.js"]
    end

    subgraph AI["ai_service/ (Flask, port 5002)"]
        FLASK["scikit-learn ensemble\n(unchanged, disease classification)"]
        subgraph DIFF["diffusion/ (NEW, isolated subpackage)"]
            CFG["config.py + configs/diffusion.yaml"]
            DATA["data/ — synthetic.py, preprocessing.py"]
            MODEL["model/ — CSDI-lite denoiser + Gaussian diffusion scheduler"]
            BASE["baselines/ — persistence, interpolation, mean, attention imputer"]
            EVAL["evaluation/ — metrics.py, run_eval.py"]
            TRAIN["training/train.py"]
            INFER["inference/service.py — model loaded ONCE, resident in memory"]
            API["api/routes.py — Flask blueprint\n/api/diffusion/{impute,forecast,generate,anomaly-score,health}"]
        end
    end

    BLE -->|"synced via frontend"| DASH
    WIFI -->|"POST /api/device/data"| EXPRESS
    DASH -->|"POST /api/device/data"| EXPRESS
    EXPRESS --> MONGO
    EXPRESS --> RULES
    EXPRESS -.->|"unchanged existing call"| FLASK
    EXPRESS -.->|"NEW: to be wired, Phase 19"| API
    MONGO --> EXPRESS --> DASH

    TRAIN --> MODEL
    MODEL --> INFER
    INFER --> API
    DATA --> TRAIN
    BASE --> EVAL
    MODEL --> EVAL
```

**What changed (see [MODIFICATION_LOG.md](MODIFICATION_LOG.md) for the
file-by-file table):**

- A new, fully isolated `ai_service/diffusion/` subpackage: its own
  dependencies (`requirements-diffusion.txt`), its own config
  (`configs/diffusion.yaml`), no shared state with the existing
  scikit-learn code.
- `ai_service/app.py` gained exactly one addition — a defensively-imported
  blueprint registration — so that if PyTorch is unavailable in a given
  deployment, the existing `/ai/predict` and `/analyze` routes are
  **provably unaffected** (verified by booting the app and calling both
  the old and new routes in the same process — see IMPLEMENTATION_REPORT.md).
- A new model-resident inference service backing four new endpoints:
  `/api/diffusion/impute` (primary task), `/api/diffusion/forecast` and
  `/api/diffusion/generate` (secondary, same underlying model),
  `/api/diffusion/anomaly-score` (secondary, derived signal for the
  existing alert pipeline, not a replacement for it).
- A mandatory smoke test (`tests/smoke_test_diffusion.py`) and a real
  (non-smoke) evaluation script (`diffusion/evaluation/run_eval.py`)
  comparing the diffusion model against deterministic baselines on
  identical held-out data.

**What did NOT change in this phase:**
- The Node/Express backend (`backend/`) — no new routes were added there
  yet; the diffusion service is reachable directly but not yet proxied
  through the backend (see IMPLEMENTATION_REPORT.md, "Known limitations").
- The React frontend (`src/`) — no UI changes yet; frontend integration is
  scoped as a follow-up phase once the model's real-data performance is
  validated, per the brief's phased approach (item 42, Phase 6 before
  Phase 18).
- The ESP32 firmware — untouched.
- The existing `ai_service/` scikit-learn disease classifier — untouched
  and confirmed still functional.
