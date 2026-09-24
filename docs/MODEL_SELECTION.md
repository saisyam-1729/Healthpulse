# Model Selection — Diffusion-Based Physiological Time-Series Component

**Status:** Phase 4 + Phase 7 deliverable. This is the decision document.
Implementation has **not** started — see [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md)
for the repository inventory and [DATA_PIPELINE.md](DATA_PIPELINE.md) for the
data constraints this decision is built on, and
[DIFFUSION_RESEARCH.md](DIFFUSION_RESEARCH.md) for the architecture survey.
Per the task brief, this document is meant to be reviewed before any code
is written.

---

## 1. Task selection (Phase 4)

Evaluating each candidate task from the brief against HealthPulse's *actual*
data and product surface (not hypothetical future data):

| Task | Evaluation against HealthPulse | Verdict |
|---|---|---|
| **A. Forecasting** | Real value: a short-horizon HR/SpO2/temp forecast with an uncertainty band is a natural, demonstrable dashboard feature, and directly extends the existing `AnalyticsPanel.tsx` recharts trend view. Data supports it (a time series exists), though sessions are short and per-device sampling is irregular. | **Include — secondary/co-primary task.** |
| **B. Missing-value imputation** | HealthPulse's data has *real, current* missingness — firmware sends `null`/skips POSTs when `fingerPresent=false` (DATA_PIPELINE.md §5). This is not a hypothetical use case; it's the single most concretely-justified task given what was actually found in the ingestion code. | **Include — primary task.** |
| **C. Synthetic generation** | No real dataset exists to train or validate against yet (ARCHITECTURE_AUDIT.md confirms no exported/available patient data). A generator is required anyway for development and the mandatory smoke test (Phase 34), and a diffusion model capable of imputation/forecasting is, as a side effect, already capable of unconditional generation (mask everything as unobserved). | **Include — secondary, largely "free" given A/B.** Not built as an independent objective. |
| **D. Probabilistic prediction** | Explicitly one of the stated goals ("82 ± uncertainty" rather than a point estimate). This is not a separate task so much as a *requirement* on how A and B are implemented — diffusion sampling naturally produces this by drawing multiple reverse-process samples. | **Cross-cutting requirement, not a standalone task.** |
| **E. Stress-conditional generation/forecasting** | DATA_PIPELINE.md §5 and ARCHITECTURE_AUDIT.md §2.3 establish that **no reliable stress ground truth exists anywhere in the system** — every "stress" value today is a hand-written heuristic (`stress.ts`, `predictionService.js`), not a measurement. Conditioning a generative model on an unreliable heuristic label risks teaching the model to reproduce the heuristic's biases and presenting that as a physiological finding, which is precisely the kind of unjustified claim the brief prohibits (§16, §38). The BLE firmware does compute `rmssd` (a genuine HRV metric) on-device, which is a *much* better candidate stress proxy, but it is not currently persisted to `HealthData` at all. | **Excluded from this phase.** Documented as realistic future work once `rmssd`/HRV is actually persisted server-side (a backend change, not an ML change) — see IMPLEMENTATION_REPORT.md (future work) once written. |
| **F. Anomaly detection** | A directly useful side effect of a working imputation/forecasting model: reconstruction error or low likelihood under the model is a standard diffusion-based anomaly signal, and it plugs naturally into the existing `Alert`/`riskLevel` machinery in the backend (`ruleEngine.js`/`healthEngine.js`) as an additional signal rather than a replacement. | **Include — secondary, derived from B without new modeling work.** |

### Selected scope

- **PRIMARY TASK: Conditional probabilistic imputation of missing physiological values**, directly matching the real missingness pattern found in the firmware/ingestion code.
- **SECONDARY TASKS:**
  1. Short-horizon probabilistic **forecasting** (same model, future window treated as fully-masked/unobserved — not a separate architecture).
  2. **Synthetic sequence generation**, for development/demo/smoke-testing (same model, entire window treated as unobserved).
  3. **Reconstruction-error-based anomaly scoring**, as an auxiliary signal feeding the existing alert pipeline, not a replacement for it.
- **EXCLUDED (for now, with a documented reason): stress-conditional generation.** Revisit only after real HRV (`rmssd`) is persisted server-side and a genuine (even if imperfect) physiological proxy label exists — not the current heuristic score.
- **Probabilistic output (uncertainty intervals)** is a cross-cutting requirement applied to both the primary and forecasting secondary task, not a separate deliverable.

This selection deliberately does **not** implement every task the brief
lists as possible — per the brief's own instruction ("do not implement
unnecessary functionality merely because a paper supports it"), stress-conditional
generation is the clearest example of a task that *sounds* valuable but
currently has no honest ground truth to condition on or validate against.

---

## 2. Candidate architectures (recap — full detail in DIFFUSION_RESEARCH.md)

1. **CSDI** — conditional score-based diffusion, mask-conditioned, imputation-native, evaluated by its authors on healthcare time series.
2. **TimeGrad** — autoregressive (RNN + per-step diffusion) probabilistic forecasting, forecasting-only.
3. **Diffusion-TS** — transformer + trend/seasonal decomposition + Fourier loss, general generation/forecasting/imputation.
4. Other candidates reviewed (PriSTI, SAITS, TimeDiff, latent-space diffusion) — see DIFFUSION_RESEARCH.md; none selected as primary, ideas partially reused where noted.

## 3. Decision

**Selected: a CSDI-inspired conditional diffusion model, adapted and scaled down for HealthPulse — not a verbatim port of the official CSDI repository.**

Concretely, adapted as follows:

- **Kept from CSDI:** the core idea — concatenate (observed values, observation mask, diffusion-noised target) and denoise with an attention-based network that mixes information across the time axis and the (tiny, 3-channel) feature axis; train with the standard denoising score-matching / noise-prediction objective; sample via the standard DDPM reverse process to get multiple draws → an empirical predictive distribution (mean + interval) rather than one point estimate.
- **Scaled down relative to the official CSDI implementation:** far smaller hidden dimensions and fewer diffusion steps than CSDI's original PhysioNet configuration, justified by (a) only 3 channels vs. dozens in the original benchmark, (b) short windows (tens of points, not hundreds), and (c) the goal of tolerable CPU inference latency for a live dashboard feature, not maximum benchmark accuracy.
- **Borrowed, not copied, from elsewhere:** an optional lightweight FFT-domain auxiliary loss term (Diffusion-TS idea) to discourage physiologically-implausible high-frequency artifacts in generated/imputed sequences, and a cheap linear-interpolation-based auxiliary conditioning input (PriSTI idea) to give the denoiser a better starting point across long gaps — both are small additions to the CSDI-style backbone, not architectural changes.
- **Forecasting reuses the same network:** the "future" prediction window is simply additional unobserved positions in the same masked-conditioning scheme — this avoids building and maintaining a second (TimeGrad-style) architecture for a task that is, in this data regime, the same operation as imputation.

## 4. Why not the alternatives — technical reasoning

- **Not TimeGrad**, because (a) it has no native mechanism for imputing gaps *inside* the observed window, which is HealthPulse's primary, concretely-evidenced need, not merely a nice-to-have; and (b) its autoregressive design runs a full diffusion sampling chain at *every* forecast step, which compounds inference latency in a way that's a poor fit for a dashboard feature expected to feel responsive, whereas a masked whole-window approach samples the entire forecast in one reverse-diffusion pass.
- **Not Diffusion-TS**, because its two headline architectural ideas — trend/seasonal decomposition and a full transformer encoder-decoder — are built for longer, more structurally seasonal series (the paper's own benchmarks are daily/hourly-scale economic and energy series) than HealthPulse's short, noisy, session-scale vitals windows. Adopting it in full would mean training a materially larger model on a dataset that, per DATA_PIPELINE.md, does not yet exist at any real scale — a clear case of complexity not justified by available data (violating the brief's own "correctness over novelty" / "no unnecessary dependencies" principles). The one genuinely useful piece (the Fourier loss) is reused as a small addition rather than adopting the whole architecture.
- **Not PriSTI**, because its core contribution — spatial attention across a network of correlated sensors — has no analogue in a single-wearable, 3-channel system; adopting it would mean carrying unused graph-attention machinery. Its coarse-interpolation conditioning trick is reused on its own.
- **Not SAITS as the primary model**, because it is deterministic and cannot express the required predictive uncertainty ("82 ± uncertainty" is an explicit goal) — but it is exactly the right shape for the **mandatory non-diffusion baseline** the implementation plan requires diffusion to be compared against, and will be implemented as that baseline, not discarded.
- **Not a latent-space diffusion variant**, because the entire motivation for operating diffusion in a compressed latent space (reducing a large raw dimensionality) does not apply here — HealthPulse's raw window is already tiny (3 channels × a short window), so adding an autoencoder would only add a second model to train, calibrate, and keep in sync, with no offsetting benefit.

No superiority claim above is backed by an experiment run on HealthPulse data — none exists yet. These are architectural-fit arguments grounded in the concrete constraints in DATA_PIPELINE.md (channel count, missingness pattern, sequence length, and the absence of long-range seasonal structure), not empirical comparisons. Any accuracy/quality claims will be reported separately in `IMPLEMENTATION_REPORT.md` and explicitly labeled as smoke-test, synthetic-benchmark, or (if it ever becomes available) real-data results — never asserted without a corresponding measured run, per the brief's anti-fabrication requirement (§38).

## 5. Integration architecture (Phase 8 preview — not yet implemented)

Consistent with ARCHITECTURE_AUDIT.md's finding that `ai_service/` is an
existing, already-deployed Python/Flask microservice with its own
deployment shape (separate from the Node backend), and per the brief's
explicit instruction to avoid unnecessary microservices:

```
ESP32 (BLE / WiFi firmware)
        │
        ▼
Node/Express backend (backend/)  ──▶  MongoDB (HealthData collection)
        │                                        │
        │  REST call (new, to be added)          │  read historical readings
        ▼                                        ▼
ai_service/ (existing Flask app) ──▶ new diffusion/ subpackage
        │        (new endpoints: /impute, /forecast, /anomaly-score)
        ▼
   REST response (values + uncertainty)
        │
        ▼
Node backend  ──▶  React frontend (new chart overlay in AnalyticsPanel.tsx)
```

**Decision: extend the existing `ai_service/` Flask app with a new
`diffusion/` subpackage and new routes, rather than standing up a second
Python microservice.** This avoids the unnecessary-microservice pattern the
brief warns against, reuses the existing deployment/process shape, and
requires only (a) fixing or explicitly working around the
`AI_SERVICE_URL` port mismatch documented in ARCHITECTURE_AUDIT.md §2.3, and
(b) keeping the new diffusion code fully isolated from the existing
scikit-learn disease-classification code (different subpackage, different
dependencies section, no shared state) so the existing `/ai/predict` and
`/analyze` behavior is not put at risk. PyTorch (needed for the diffusion
model) is not currently a dependency of `ai_service/` and will be added
explicitly, scoped to the new subpackage.

This integration design, and the detailed endpoint/request/response
contracts, will be finalized and implemented in the next phase (Phase 8-9)
and is not part of this document's scope.

---

## 6. Open questions for the project owner

Several of the decisions above (excluding stress-conditioning, treating
pre-existing bugs as out of scope, assuming synthetic-only data) are
reasonable defaults but not unilateral calls that should stand without
sign-off. See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) for the full list to
raise before implementation proceeds.
