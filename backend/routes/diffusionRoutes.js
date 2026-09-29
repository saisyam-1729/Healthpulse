const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const HealthData = require('../models/HealthData');
const authMiddleware = require('../config/authMiddleware');
const { buildGrid, futureTimestamps } = require('../services/diffusionGrid');

const router = express.Router();

// Defaults mirror ai_service/configs/diffusion.yaml (context_length 24, 5 s sampling).
const STEP_SECONDS = Number(process.env.DIFFUSION_STEP_SECONDS) || 5;
const CONTEXT_POINTS = Number(process.env.DIFFUSION_CONTEXT_POINTS) || 24;
const timeoutMs = () => Number(process.env.DIFFUSION_TIMEOUT_MS) || 30000;
const MIN_OBSERVED_STEPS = 6;
const MAX_PREDICTION_STEPS = 12;
const DEFAULT_PREDICTION_STEPS = 6;
const STALE_AFTER_MS = 15 * 60 * 1000;

const DISCLAIMER =
  'Model-generated estimates for research/demo purposes. Not measurements, not medical advice or diagnosis.';

const serviceUrl = () =>
  (process.env.DIFFUSION_SERVICE_URL || process.env.AI_SERVICE_URL || 'http://localhost:5002').replace(/\/+$/, '');

// Each request runs many denoising passes on the Python side, so keep this tighter than the general limiter.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many forecast requests, please slow down.' },
});

router.use(authMiddleware, limiter);

function mapUpstreamError(err, res) {
  if (err.response) {
    const status = err.response.status === 503 ? 503 : 502;
    return res.status(status).json({
      error: err.response.data?.error || 'Diffusion service returned an error',
    });
  }
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return res.status(504).json({ error: 'Diffusion service timed out' });
  }
  return res.status(503).json({ error: 'Diffusion service is unavailable' });
}

// GET /api/diffusion/status
router.get('/status', async (req, res) => {
  try {
    const { data } = await axios.get(`${serviceUrl()}/api/diffusion/health`, { timeout: 3000 });
    res.json({ available: true, modelLoaded: !!data.modelLoaded });
  } catch {
    res.json({ available: false, modelLoaded: false });
  }
});

// GET /api/diffusion/insights?predictionLength=6
// Fills gaps in the user's recent readings and forecasts the next few steps, with uncertainty bands.
router.get('/insights', async (req, res) => {
  const raw = req.query.predictionLength;
  const predictionLength = raw === undefined ? DEFAULT_PREDICTION_STEPS : Number(raw);
  if (!Number.isInteger(predictionLength) || predictionLength < 1 || predictionLength > MAX_PREDICTION_STEPS) {
    return res.status(400).json({ error: `predictionLength must be an integer between 1 and ${MAX_PREDICTION_STEPS}` });
  }

  try {
    const recent = await HealthData.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(200).lean();
    const grid = buildGrid(recent, { stepSeconds: STEP_SECONDS, points: CONTEXT_POINTS });

    if (grid.observedSteps < MIN_OBSERVED_STEPS) {
      return res.status(422).json({
        error: `Not enough recent readings (${grid.observedSteps} of the last ${CONTEXT_POINTS} steps; need at least ${MIN_OBSERVED_STEPS}).`,
      });
    }

    const http = { timeout: timeoutMs() };
    const [imputed, forecast] = await Promise.all([
      axios.post(`${serviceUrl()}/api/diffusion/impute`, { readings: grid.rows }, http),
      axios.post(`${serviceUrl()}/api/diffusion/forecast`, { readings: grid.rows, predictionLength }, http),
    ]);

    res.json({
      generated: true,
      disclaimer: DISCLAIMER,
      stepSeconds: STEP_SECONDS,
      observedSteps: grid.observedSteps,
      latestReadingAt: new Date(grid.anchor).toISOString(),
      stale: Date.now() - grid.anchor > STALE_AFTER_MS,
      context: {
        timestamps: grid.timestamps,
        observed: grid.rows.map((r) => r.heartRate !== null || r.spo2 !== null || r.temperature !== null),
        measured: grid.rows,
        imputed: imputed.data.imputed,
        lower: imputed.data.lower,
        upper: imputed.data.upper,
      },
      forecast: {
        timestamps: futureTimestamps(grid.anchor, predictionLength, STEP_SECONDS),
        mean: forecast.data.forecast,
        lower: forecast.data.lower,
        upper: forecast.data.upper,
      },
    });
  } catch (err) {
    if (err.isAxiosError) return mapUpstreamError(err, res);
    console.error('[diffusion] insights failed:', err.message);
    res.status(500).json({ error: 'Failed to build diffusion insights' });
  }
});

// POST /api/diffusion/generate  { length }
// Fully synthetic sequence for the research/demo view. Always flagged synthetic.
router.post('/generate', async (req, res) => {
  const length = req.body?.length ?? 30;
  if (!Number.isInteger(length) || length < 1 || length > 120) {
    return res.status(400).json({ error: 'length must be an integer between 1 and 120' });
  }
  try {
    const { data } = await axios.post(`${serviceUrl()}/api/diffusion/generate`, { length }, { timeout: timeoutMs() });
    res.json({ synthetic: true, disclaimer: DISCLAIMER, stepSeconds: STEP_SECONDS, ...data });
  } catch (err) {
    if (err.isAxiosError) return mapUpstreamError(err, res);
    res.status(500).json({ error: 'Failed to generate sequence' });
  }
});

module.exports = router;
