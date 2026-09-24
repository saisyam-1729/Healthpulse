# HealthPulse AI

AI-Powered Wearable Health Monitoring System built with React, Node.js, Express, and MongoDB.

## Features

- **Real-Time Monitoring** — Live heart rate, SpO2, and temperature tracking from ESP32 wearable
- **AI Stress Analysis** — Intelligent stress scoring using physiological data
- **Emergency Alerts** — Instant WhatsApp notifications for abnormal vitals
- **Health Reports** — PDF blood report analysis with 35+ parameters
- **Admin Dashboard** — User management, feedback monitoring, and data export

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Express + MongoDB
- **Deployment:** Vercel (frontend) + Render (backend)

## Getting Started

```bash
npm install
npm run dev
```

## Diffusion-Based Physiological Modeling

A conditional diffusion component for HealthPulse's heart-rate/SpO2/
temperature time series lives in `ai_service/diffusion/`. Full writeup:
[docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md). Design
docs: [ARCHITECTURE_AUDIT](docs/ARCHITECTURE_AUDIT.md) ·
[DATA_PIPELINE](docs/DATA_PIPELINE.md) ·
[DIFFUSION_RESEARCH](docs/DIFFUSION_RESEARCH.md) ·
[MODEL_SELECTION](docs/MODEL_SELECTION.md).

**Why:** the firmware genuinely produces missing readings (finger-off
gaps), and no time-series ML existed in the repo before this. **What:** a
scaled-down CSDI-inspired conditional diffusion model — primary task is
probabilistic imputation; forecasting, synthetic generation, and
anomaly-scoring reuse the same model. **Status:** trained to convergence
(100 epochs) on synthetic data; on held-out synthetic test windows it
statistically ties the best deterministic baseline on point-estimate
accuracy (MAE 0.268 vs. 0.269) while additionally providing calibrated
uncertainty intervals (82.4% coverage at a 90% target) that no
deterministic baseline can produce — see the full numbers and honest
caveats in the report. **Not yet validated on real HealthPulse data, and
not yet integrated into the frontend or proxied through the Node backend.**

### Quickstart

```bash
cd ai_service
python -m pip install -r requirements.txt -r requirements-diffusion.txt

# Smoke test (fast, ~10s, verifies the whole pipeline end-to-end)
cd ..
python -m pytest tests/smoke_test_diffusion.py -v

# Train (full production config — measured ~2h15m for 100 epochs on CPU;
# use configs/diffusion_dev.yaml for a ~12-minute reduced-scale run instead)
cd ai_service
python -m diffusion.training.train --config configs/diffusion.yaml

# Evaluate against the mandatory non-diffusion baselines
python -m diffusion.evaluation.run_eval \
    --config configs/diffusion.yaml \
    --checkpoint checkpoints/best.pt \
    --output checkpoints/eval_results.json \
    --max-test-windows 300

# Start the inference API (existing Flask service, now with /api/diffusion/*)
python app.py
# then: POST http://localhost:5002/api/diffusion/impute
#       POST http://localhost:5002/api/diffusion/forecast
#       POST http://localhost:5002/api/diffusion/generate
#       POST http://localhost:5002/api/diffusion/anomaly-score
#       GET  http://localhost:5002/api/diffusion/health
```

### Limitations (see the full list in IMPLEMENTATION_REPORT.md)

No real HealthPulse data was used or is available — all results are on
synthetic data. Diffusion's demonstrated edge is calibrated uncertainty,
not raw point-estimate accuracy (a much simpler attention-based baseline
ties it on MAE/RMSE). Frontend/backend integration and real-data
validation are the documented next steps before any production claim.
