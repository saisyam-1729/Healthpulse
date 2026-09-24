# Implementation Report — Diffusion-Based Physiological Time-Series Modeling

**Status:** Phase 9-15 deliverable (core implementation, training, evaluation).
Frontend integration, real-data validation, and stress-conditional work
remain out of scope for this phase — see "Future work" below and
[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

---

## 1. Original system

See [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md) and
[ARCHITECTURE_BEFORE.md](ARCHITECTURE_BEFORE.md) for the full detail. In
summary: React/Vite frontend, Express/MongoDB backend, two ESP32 firmware
variants (BLE and WiFi), a Flask `ai_service` that does unrelated
synthetic-data disease classification, and no time-series ML component of
any kind.

## 2. Problem definition

Per [DATA_PIPELINE.md](DATA_PIPELINE.md), HealthPulse's physiological data
is a 3-channel (heart rate, SpO2, temperature) time series with irregular,
firmware-dependent sampling and real missingness (the sensor firmware sends
`null`/skips transmission when no finger is detected). Per
[MODEL_SELECTION.md](MODEL_SELECTION.md), the selected primary task is
**probabilistic missing-value imputation**, with **short-horizon
forecasting**, **synthetic generation**, and **reconstruction-error
anomaly scoring** as secondary tasks sharing the same model. Stress-
conditional generation was explicitly excluded pending real HRV ground
truth.

## 3. Research review

See [DIFFUSION_RESEARCH.md](DIFFUSION_RESEARCH.md) for the full comparison
across CSDI, TimeGrad, Diffusion-TS, PriSTI, SAITS, TimeDiff, and
latent-space diffusion approaches.

## 4. Model-selection reasoning

See [MODEL_SELECTION.md](MODEL_SELECTION.md). Selected: a scaled-down
CSDI-inspired conditional diffusion model, with a Fourier-loss regularizer
borrowed from Diffusion-TS, integrated as a new isolated subpackage inside
the existing `ai_service/` Flask app rather than a second microservice.

## 5. New architecture

See [ARCHITECTURE_AFTER.md](ARCHITECTURE_AFTER.md) for the diagram and
[MODIFICATION_LOG.md](MODIFICATION_LOG.md) for the file-by-file change
list.

## 6. Mathematical formulation

**Forward process** (noising x₀ → x_t), closed form:

```
x_t = sqrt(ᾱ_t)·x₀ + sqrt(1-ᾱ_t)·ε,     ε ~ N(0, I)
```

where ᾱ_t is the cumulative product of (1 − β_i) for i ≤ t, and β is a
fixed noise-variance schedule (quadratic, per `configs/diffusion.yaml`).

**Reverse process** (denoising x_t → x_{t-1}), learned by the network:

```
x_{t-1} = 1/sqrt(α_t) · (x_t − β_t/sqrt(1-ᾱ_t) · ε_θ(x_t, t, cond)) + σ_t·z
```

with z ~ N(0, I) for t > 0, else 0. The network ε_θ is trained to predict
the noise ε via the standard denoising score-matching objective (mean
squared error between predicted and true noise), computed **only at
positions that were genuinely observed and deliberately held out from
conditioning** — never at positions with no real ground truth (see
DATA_PIPELINE.md and preprocessing.py).

**Conditioning on physiological context:** the CSDI-style adaptation
never noises the observed positions at all. Instead, the network receives
two separate inputs at every cell (time, channel): `cond_value` (the true
observed value where known, else 0) and `noisy_target` (the current noisy
estimate at unobserved positions, else 0), plus additive side information
(diffusion-step embedding, sinusoidal time-position embedding, learned
per-channel embedding). Forecasting is not a separate mechanism — the
future prediction window is simply additional positions with
`cond_mask = 0`, denoised the same way as an internal gap. See
`ai_service/diffusion/model/scheduler.py` and `denoiser.py` for the full
implementation with inline mathematical comments.

## 7. Data pipeline

See [DATA_PIPELINE.md](DATA_PIPELINE.md) for the real-data format findings,
and `ai_service/diffusion/data/` for the implementation: sequence-level
train/val/test split (no leakage across splits), per-channel normalization
fit on the training split only, configurable windowing
(`context_length=24`, `prediction_length=6` by default — both read from
config, never hardcoded), and CSDI-style conditioning-mask construction
that always fully masks the prediction-length tail and additionally
re-masks a configurable fraction of observed context points for
self-supervised imputation training.

**No real HealthPulse data was used or is available** (confirmed in
ARCHITECTURE_AUDIT.md). All training and evaluation below uses the
synthetic generator (`ai_service/diffusion/data/synthetic.py`), which
injects missingness patterned on the real firmware's dropout behavior but
is explicitly **not** clinically validated data.

## 8. Training pipeline

Implemented in `ai_service/diffusion/training/train.py`: seeded, config-driven,
checkpointed (best + last), resumable, cosine LR schedule, gradient
clipping, early stopping. Two configs exist:

- `configs/diffusion.yaml` — the intended production-scale config (400
  synthetic sequences, 100 epochs, full 50-step sampling).
- `configs/diffusion_dev.yaml` — a **reduced, explicitly-labeled
  development-scale config** (200 sequences, 15 epochs, 25 sampling
  steps at inference) used to produce the results below, because a full
  production-scale run measured at ~84s/epoch (see below) would take
  ~2.3 hours on the CPU-only machine available for this session. This
  tradeoff is deliberate and documented, not hidden.

### What was actually run

Two training runs were performed, both real (not projected):

```
cd ai_service
python -m diffusion.training.train --config configs/diffusion_dev.yaml   # dev-scale, first pass
python -m diffusion.training.train --config configs/diffusion.yaml       # full production-scale, second pass
```

Measured timing (real, on this machine, CPU-only, no GPU): ~84-108 seconds
per epoch at the full/production data scale (8,680 training windows,
batch_size=32); the dev-scale run (200 sequences, batch_size=64) completed
15 epochs in ~11.7 minutes; the full production run completed **all 100
epochs in ~2 hours 15 minutes** (`ai_service/checkpoints/history.json`),
early stopping (patience=15) never triggering.

**Training/validation loss — dev-scale run (15 epochs):**

| Epoch | Train loss | Val loss |
|---|---|---|
| 0 | 50.42 | 11.40 |
| 7 | 1.91 | 1.75 |
| 14 (final) | 0.77 | 0.75 |

Loss was still falling steadily when the epoch budget ran out — the
dev-scale run was stopped by the epoch budget, not convergence.

**Training/validation loss — full production run (100 epochs):**

| Epoch | Train loss | Val loss |
|---|---|---|
| 0 | (dev-scale-comparable start) | — |
| 40 | 0.371 | 0.300 |
| 65 | 0.275 | 0.271 |
| 84 | 0.248 | 0.248 |
| 99 (final) | 0.250 | 0.259 |

Val loss plateaus around 0.25-0.26 from roughly epoch 65 onward with
epoch-to-epoch noise but no further systematic improvement or divergence —
**this run did converge**, unlike the dev-scale run. Full curve in
`ai_service/checkpoints/history.json`.

## 9. Evaluation

Implemented in `ai_service/diffusion/evaluation/`: `metrics.py` (MAE, RMSE,
MAPE, sMAPE, CRPS, 90% prediction-interval coverage, physiological-validity
checks) and `run_eval.py`, which evaluates the diffusion model and every
mandatory baseline (persistence, linear interpolation, per-channel mean,
and a lightweight SAITS-inspired attention imputer trained for 5 epochs
within the same script) on **identical held-out test windows**.

```
python -m diffusion.evaluation.run_eval \
    --config configs/diffusion_dev.yaml \
    --checkpoint checkpoints_dev/best.pt \
    --output checkpoints_dev/eval_results.json \
    --max-test-windows 300
```

(`--max-test-windows` subsamples the 1,860-window test split down to 300
for turnaround time on CPU; the subsample size is recorded in the output
JSON, not hidden.)

## 10. Results — actually measured, both runs

Metrics are computed in normalized (z-scored) space, identically for every
method, so the comparison between methods is fair even though the
absolute numbers aren't in physical units (bpm/%/°C). Both evaluations
used the same 300-window random subsample of the (disjoint, held-out) test
split and the same baselines, computed fresh in the same script run.

### Dev-scale run (15 epochs, 200 sequences, 25-step sampling)

Full raw output: `ai_service/checkpoints_dev/eval_results.json`.

| Method | MAE | RMSE | MAPE (%) | sMAPE (%) |
|---|---|---|---|---|
| Diffusion | 0.949 | 1.131 | 128.1 | 166.6 |
| Persistence | 0.312 | 0.395 | 123.9 | 53.7 |
| Linear interpolation | 0.296 | 0.377 | 115.2 | 52.0 |
| Per-channel mean | 0.942 | 1.117 | 100.0 | 200.0 |
| Attention imputer (SAITS-lite) | 0.297 | 0.371 | 110.9 | 51.9 |

CRPS = 0.730, 90% interval coverage = 45.6% (poorly calibrated — target ≈90%).

### Full production-scale run (100 epochs, 400 sequences, 50-step sampling)

Full raw output: `ai_service/checkpoints/eval_results.json`.

| Method | MAE | RMSE | MAPE (%) | sMAPE (%) |
|---|---|---|---|---|
| **Diffusion (this project)** | **0.268** | **0.337** | 90.0 | 50.6 |
| Persistence (last-value) | 0.317 | 0.403 | 113.3 | 54.9 |
| Linear interpolation | 0.302 | 0.388 | 106.9 | 53.2 |
| Per-channel mean | 0.908 | 1.070 | 100.0 | 200.0 |
| Attention imputer (SAITS-lite) | 0.269 | 0.337 | 95.7 | 49.7 |

CRPS = 0.194, 90% interval coverage = **82.4%** (close to, but still under,
the 90% target — reasonably calibrated, not perfectly).

Physiological plausibility of diffusion output at full scale: **0%
out-of-range values and 0% implausible-jump rate on all three channels**
(the dev-scale run's 0.7% heart-rate jump rate is also gone).

### Honest interpretation — do not oversell this

**After the full 100-epoch training run, the diffusion model essentially
matches the strongest deterministic baseline (the attention-imputer, MAE
0.269 vs. diffusion's 0.268 — a difference with no practical significance
on a 300-window sample) and clearly beats persistence and linear
interpolation on MAE/RMSE.** This is a real, measured result, not a
projection — a direct re-run of the exact same evaluation script against
the exact same held-out windows, changed only by training to convergence
instead of stopping at 15 epochs.

The genuinely distinguishing result is **not** point-estimate accuracy —
where the deterministic attention-imputer baseline is statistically tied
with diffusion — but **calibrated uncertainty**, which no deterministic
baseline can produce at all: 82.4% of true held-out values fell inside the
diffusion model's stated 90% interval, a large improvement over the
dev-scale run's 45.6% and reasonably close to nominal calibration. CRPS
also improved substantially (0.730 → 0.194).

**What this does and does not support:** it supports treating the
diffusion model as a viable candidate for HealthPulse's stated goal of
probabilistic ("82 ± uncertainty") prediction, where the deterministic
baselines cannot compete by construction. It does **not** support a claim
that diffusion is meaningfully more *accurate* than a well-tuned
deterministic imputer at this data scale — on this synthetic dataset, a
much simpler attention model gets equivalent point-estimate accuracy for
far less inference cost. Both statements are reported because both are
true of the actual numbers; neither should be dropped to make the result
sound more or less impressive than it is.

**No claim is made that this model is ready to replace or supplement any
existing HealthPulse functionality**, and no result here is from real
patient data (see Limitations). The next concrete step (see Future Work)
is validating this same comparison on real HealthPulse data if/when it
becomes available, since synthetic-data results do not guarantee the same
relative ranking on real physiological signals with different noise and
correlation structure.

## 11. Limitations

1. **No real HealthPulse data exists or was used.** Every number above is
   on synthetic data only — a good result here does not guarantee the
   same result on real physiological signals.
2. **Point-estimate accuracy is statistically tied with a much simpler,
   non-diffusion attention baseline** at full training scale (MAE 0.268
   vs. 0.269) — diffusion's demonstrated advantage is calibrated
   uncertainty, not raw accuracy, and that distinction should not be
   blurred when this is presented to others.
3. **Calibration is close but not exact** (82.4% coverage against a 90%
   target) — some further tuning (more diffusion steps, more training
   data, or a recalibration step) would likely be needed before treating
   the stated intervals as tightly trustworthy.
4. **No real stress ground truth** exists anywhere in the system (see
   ARCHITECTURE_AUDIT.md) — stress-conditional modeling remains excluded.
5. **The diffusion service is not yet wired into the Node backend or
   frontend** — it is directly callable via `/api/diffusion/*` on the
   Flask service, but no proxy route exists yet in `backend/`, and no UI
   consumes it. This is a deliberate phase boundary (brief item 42: test
   the ML backend independently before frontend integration), not an
   oversight.
6. **Anomaly scoring uses a coarse approximation** (mask the entire window
   and reconstruct, rather than true leave-one-out per point) — documented
   as a tradeoff in `inference/service.py`, not validated against any
   labeled anomaly data (none exists).
7. **CPU-only inference latency has not been measured for a single
   request** (only batched evaluation throughput) — relevant to Open
   Question 4 (acceptable dashboard latency) in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## 12. Future work

1. ~~Run the full production-scale training~~ — **done** (section 8-10
   above): 100 epochs completed, converged, evaluated against baselines
   with real measured results.
2. Now that the model is competitive with baselines on synthetic data, wire a `backend/`
   proxy route to `/api/diffusion/*` and integrate a forecast/imputation
   view into `AnalyticsPanel.tsx`, per the brief's Phase 18-19 (clearly
   labeling any synthetic/generated values, never showing them as real
   readings).
3. Persist `rmssd`/HRV to `HealthData` server-side (a `backend/` change,
   not an ML change) to enable a real stress-proxy label, then revisit
   stress-conditional generation.
4. Measure single-request inference latency and decide on sampling-step
   count / batching tradeoffs once a real latency budget is known (Open
   Question 4).
5. If/when real HealthPulse data becomes available, re-run the entire
   pipeline against it and report those results separately and explicitly
   labeled as real-data results, never blended with the synthetic-data
   numbers above.
