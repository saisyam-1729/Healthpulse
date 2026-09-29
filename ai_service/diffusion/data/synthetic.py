"""Synthetic physiological time-series generator.

IMPORTANT: this data is NOT clinically validated and must never be
presented as real patient data or medical advice (see docs, item 16 and 34
of the implementation brief). It exists solely for:
  - local development without access to real HealthPulse data,
  - the mandatory smoke test (tests/smoke_test_diffusion.py),
  - the '/generate' research/demo endpoint, whose responses the frontend
    must visually label as synthetic.

The generator produces heart rate, SpO2, and temperature channels with
smooth temporal dynamics and cross-channel correlation loosely modeled on
plausible physiology (HR rising slightly depresses SpO2, temperature drifts
slowly), plus injected missingness that mirrors the REAL missingness
pattern found in the ESP32 firmware (see docs/DATA_PIPELINE.md section 5):
isolated random dropouts, and longer contiguous "finger removed" gaps.
"""
from __future__ import annotations

import dataclasses
from typing import Optional

import numpy as np

CHANNEL_ORDER = ("heartRate", "spo2", "temperature")

# Physiologically plausible clipping ranges, matching the backend's own
# ingestion validator (backend/routes/deviceRoutes.js), not invented here.
VALID_RANGES = {
    "heartRate": (30.0, 220.0),
    "spo2": (0.0, 100.0),
    "temperature": (30.0, 45.0),
}


@dataclasses.dataclass
class SyntheticDataset:
    values: np.ndarray       # (num_sequences, sequence_length, num_channels), NaN where missing
    mask: np.ndarray         # same shape, 1.0 = observed, 0.0 = missing
    timestamps: np.ndarray   # (num_sequences, sequence_length) seconds since sequence start
    channel_order: tuple = CHANNEL_ORDER


def _generate_one_sequence(
    rng: np.random.Generator,
    length: int,
    interval_seconds: float,
) -> np.ndarray:
    """One (length, 3) array of smoothly-varying, cross-correlated vitals."""
    t = np.arange(length)

    # Heart rate: baseline + slow drift (random walk, smoothed) + small periodic
    # component (e.g. breathing-linked variability) + observation noise.
    hr_baseline = rng.uniform(62, 85)
    hr_walk = np.cumsum(rng.normal(0, 0.6, size=length))
    hr_walk -= np.linspace(0, hr_walk[-1], length)  # remove net drift, keep local wander
    hr_periodic = 2.0 * np.sin(2 * np.pi * t / max(8, length // 3))
    heart_rate = hr_baseline + hr_walk + hr_periodic + rng.normal(0, 1.0, size=length)

    # SpO2: high baseline, weakly and inversely coupled to HR excursions above
    # baseline (a loose, illustrative coupling only — not a clinical model),
    # plus its own small noise.
    spo2_baseline = rng.uniform(96.0, 99.0)
    hr_excursion = heart_rate - hr_baseline
    spo2 = spo2_baseline - 0.03 * np.clip(hr_excursion, 0, None) + rng.normal(0, 0.3, size=length)

    # Temperature: very slow drift, small noise, independent of HR/SpO2.
    temp_baseline = rng.uniform(36.4, 37.0)
    temp_walk = np.cumsum(rng.normal(0, 0.01, size=length))
    temperature = temp_baseline + temp_walk + rng.normal(0, 0.05, size=length)

    seq = np.stack([heart_rate, spo2, temperature], axis=-1)
    for i, ch in enumerate(CHANNEL_ORDER):
        lo, hi = VALID_RANGES[ch]
        seq[:, i] = np.clip(seq[:, i], lo, hi)
    return seq


def _inject_missingness(
    rng: np.random.Generator,
    length: int,
    num_channels: int,
    missing_prob: float,
    gap_prob: float,
    gap_length_range: tuple,
) -> np.ndarray:
    """Return a (length, num_channels) mask: 1.0 observed, 0.0 missing.

    Mirrors the two real missingness modes found in the firmware audit:
    isolated per-channel dropouts, and multi-step contiguous gaps (modeling
    a "finger removed from sensor" period, which drops all channels at
    once since a single PPG/temp read cycle produces all three).
    """
    mask = np.ones((length, num_channels), dtype=np.float32)

    # Isolated single-channel dropouts.
    dropout = rng.random((length, num_channels)) < missing_prob
    mask[dropout] = 0.0

    # Contiguous "finger removed" gaps affecting all channels at once.
    t = 0
    while t < length:
        if rng.random() < gap_prob:
            gap_len = int(rng.integers(gap_length_range[0], gap_length_range[1] + 1))
            end = min(length, t + gap_len)
            mask[t:end, :] = 0.0
            t = end
        else:
            t += 1
    return mask


def generate_synthetic_dataset(
    num_sequences: int,
    sequence_length: int,
    sampling_interval_seconds: float = 5.0,
    missing_prob: float = 0.1,
    gap_prob: float = 0.05,
    gap_length_range: tuple = (3, 8),
    seed: Optional[int] = None,
) -> SyntheticDataset:
    """Generate a batch of independent synthetic physiological sequences."""
    rng = np.random.default_rng(seed)
    num_channels = len(CHANNEL_ORDER)

    values = np.empty((num_sequences, sequence_length, num_channels), dtype=np.float32)
    mask = np.empty((num_sequences, sequence_length, num_channels), dtype=np.float32)
    timestamps = np.empty((num_sequences, sequence_length), dtype=np.float64)

    for i in range(num_sequences):
        seq = _generate_one_sequence(rng, sequence_length, sampling_interval_seconds)
        seq_mask = _inject_missingness(
            rng, sequence_length, num_channels, missing_prob, gap_prob, gap_length_range
        )
        seq_with_nan = seq.copy()
        seq_with_nan[seq_mask == 0.0] = np.nan

        values[i] = seq_with_nan
        mask[i] = seq_mask
        timestamps[i] = np.arange(sequence_length) * sampling_interval_seconds

    return SyntheticDataset(values=values, mask=mask, timestamps=timestamps)


def generate_from_config(data_cfg) -> SyntheticDataset:
    """Convenience wrapper reading `data.synthetic` from a loaded DiffusionConfig."""
    s = data_cfg.synthetic
    return generate_synthetic_dataset(
        num_sequences=s["num_sequences"],
        sequence_length=s["sequence_length"],
        sampling_interval_seconds=s["sampling_interval_seconds"],
        missing_prob=s["missing_prob"],
        gap_prob=s["gap_prob"],
        gap_length_range=tuple(s["gap_length_range"]),
        seed=s.get("seed"),
    )
