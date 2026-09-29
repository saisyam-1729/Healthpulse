"""Mandatory non-diffusion baselines (implementation brief, item 14).

The diffusion model must never be evaluated in isolation. These are
deterministic, cheap-to-compute point estimators operating on the exact
same (values, cond_mask) representation the diffusion model consumes, so
evaluation.py can score them with identical metrics on identical windows.

All functions take:
  values:    (L, C) float array, normalized or raw (caller's choice, but
             must match the ground truth's scale for fair MAE/RMSE).
  cond_mask: (L, C) 1 = known/given, 0 = to be predicted.
and return a (L, C) point-estimate array covering every position (values at
cond_mask==1 positions are simply the known values, echoed back unchanged).
"""
from __future__ import annotations

import numpy as np


def persistence_baseline(values: np.ndarray, cond_mask: np.ndarray) -> np.ndarray:
    """Last-observed-value-carried-forward; backward-filled at the start."""
    L, C = values.shape
    out = values.copy()
    for c in range(C):
        last_known = None
        for t in range(L):
            if cond_mask[t, c] == 1:
                last_known = values[t, c]
            elif last_known is not None:
                out[t, c] = last_known
        # Backward-fill any leading unconditioned run.
        first_known = None
        for t in range(L):
            if cond_mask[t, c] == 1:
                first_known = values[t, c]
                break
        if first_known is not None:
            for t in range(L):
                if cond_mask[t, c] == 1:
                    break
                out[t, c] = first_known
    return out


def mean_baseline(values: np.ndarray, cond_mask: np.ndarray, channel_means: np.ndarray) -> np.ndarray:
    """Fill every unconditioned cell with the (training-set) per-channel mean."""
    out = values.copy()
    L, C = values.shape
    for c in range(C):
        out[cond_mask[:, c] == 0, c] = channel_means[c]
    return out


def linear_interpolation_baseline(values: np.ndarray, cond_mask: np.ndarray) -> np.ndarray:
    """Linear interpolation between known anchor points per channel.

    Positions before the first / after the last known anchor are filled
    flat (constant extrapolation), matching pandas' default ffill/bfill
    behavior for interpolation edges.
    """
    L, C = values.shape
    out = values.copy()
    t = np.arange(L)
    for c in range(C):
        known_t = t[cond_mask[:, c] == 1]
        known_v = values[cond_mask[:, c] == 1, c]
        if len(known_t) == 0:
            continue  # nothing to interpolate from; leave as-is (caller should handle all-missing channel)
        if len(known_t) == 1:
            out[:, c] = known_v[0]
            continue
        interpolated = np.interp(t, known_t, known_v)
        out[cond_mask[:, c] == 0, c] = interpolated[cond_mask[:, c] == 0]
    return out


BASELINES = {
    "persistence": persistence_baseline,
    "linear_interpolation": linear_interpolation_baseline,
    # 'mean' is registered separately by the evaluation script since it needs
    # the training-set channel means as an extra argument.
}
