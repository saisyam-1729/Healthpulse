"""Evaluation metrics for point estimates, probabilistic samples, and
physiological plausibility — see docs, implementation brief items 15-16.

Deliberately does NOT report "accuracy" for continuous regression/
generation outputs (per the brief's explicit instruction), and every
function here only computes a number; it does not decide what counts as
"good" — that judgment belongs in the report that consumes these numbers,
and must be based on an actual measured run, never asserted a priori.
"""
from __future__ import annotations

from typing import Optional

import numpy as np

from diffusion.data.synthetic import VALID_RANGES, CHANNEL_ORDER


def _masked(pred: np.ndarray, true: np.ndarray, mask: np.ndarray):
    m = mask.astype(bool)
    return pred[m], true[m]


def mae(pred: np.ndarray, true: np.ndarray, mask: np.ndarray) -> float:
    p, t = _masked(pred, true, mask)
    if len(p) == 0:
        return float("nan")
    return float(np.mean(np.abs(p - t)))


def rmse(pred: np.ndarray, true: np.ndarray, mask: np.ndarray) -> float:
    p, t = _masked(pred, true, mask)
    if len(p) == 0:
        return float("nan")
    return float(np.sqrt(np.mean((p - t) ** 2)))


def mape(pred: np.ndarray, true: np.ndarray, mask: np.ndarray, eps: float = 1e-3) -> float:
    p, t = _masked(pred, true, mask)
    if len(p) == 0:
        return float("nan")
    denom = np.clip(np.abs(t), eps, None)
    return float(np.mean(np.abs(p - t) / denom) * 100.0)


def smape(pred: np.ndarray, true: np.ndarray, mask: np.ndarray, eps: float = 1e-3) -> float:
    p, t = _masked(pred, true, mask)
    if len(p) == 0:
        return float("nan")
    denom = np.clip((np.abs(p) + np.abs(t)) / 2.0, eps, None)
    return float(np.mean(np.abs(p - t) / denom) * 100.0)


def crps_from_samples(samples: np.ndarray, true: np.ndarray, mask: np.ndarray) -> float:
    """Empirical CRPS estimated from Monte Carlo samples (standard NRG estimator).

    samples: (num_samples, ..., ) matching `true`/`mask` shape on the trailing dims.
    """
    num_samples = samples.shape[0]
    m = mask.astype(bool)
    true_m = true[m]
    if len(true_m) == 0 or num_samples < 2:
        return float("nan")
    samples_m = samples[:, m]  # (num_samples, num_masked)

    term1 = np.mean(np.abs(samples_m - true_m[None, :]), axis=0)
    # Pairwise term via sorted-sample trick (unbiased NRG estimator).
    sorted_samples = np.sort(samples_m, axis=0)
    weights = (2 * np.arange(1, num_samples + 1) - num_samples - 1) / (num_samples**2)
    term2 = np.sum(weights[:, None] * sorted_samples, axis=0)
    crps = term1 - term2
    return float(np.mean(crps))


def prediction_interval_coverage(
    samples: np.ndarray, true: np.ndarray, mask: np.ndarray, interval: float = 0.9
) -> float:
    """Fraction of masked ground-truth points falling inside the empirical interval."""
    lower_q = (1 - interval) / 2
    upper_q = 1 - lower_q
    lower = np.quantile(samples, lower_q, axis=0)
    upper = np.quantile(samples, upper_q, axis=0)
    m = mask.astype(bool)
    inside = (true[m] >= lower[m]) & (true[m] <= upper[m])
    if inside.size == 0:
        return float("nan")
    return float(np.mean(inside))


def physiological_validity_report(values: np.ndarray) -> dict:
    """Sanity checks — NOT a claim of clinical validity (brief item 16).

    Flags statistically-plausible-looking but physiologically implausible
    output: out-of-range values and unrealistic instantaneous jumps. This
    is a coarse filter, not a substitute for clinical review.
    """
    report = {}
    for i, ch in enumerate(CHANNEL_ORDER):
        lo, hi = VALID_RANGES[ch]
        col = values[..., i]
        out_of_range = np.mean((col < lo) | (col > hi))
        diffs = np.abs(np.diff(col, axis=-1))
        # A rough "implausible jump" threshold per channel (not clinically
        # validated — a coarse heuristic flag for gross model failure only).
        jump_threshold = {"heartRate": 15.0, "spo2": 8.0, "temperature": 1.0}[ch]
        implausible_jump_rate = float(np.mean(diffs > jump_threshold)) if diffs.size else float("nan")
        report[ch] = {
            "out_of_range_fraction": float(out_of_range),
            "implausible_jump_fraction": implausible_jump_rate,
        }
    return report


def summarize(
    pred: np.ndarray,
    true: np.ndarray,
    mask: np.ndarray,
    samples: Optional[np.ndarray] = None,
    prediction_interval: float = 0.9,
) -> dict:
    result = {
        "mae": mae(pred, true, mask),
        "rmse": rmse(pred, true, mask),
        "mape": mape(pred, true, mask),
        "smape": smape(pred, true, mask),
    }
    if samples is not None:
        result["crps"] = crps_from_samples(samples, true, mask)
        result[f"coverage_{int(prediction_interval*100)}"] = prediction_interval_coverage(
            samples, true, mask, prediction_interval
        )
    return result
