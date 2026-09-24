"""Reproducible preprocessing pipeline: split -> normalize -> window -> mask.

Design constraints enforced here (see docs/MODEL_SELECTION.md and the
implementation brief, item 10):
  - Splitting happens at the SEQUENCE level, before any windowing or
    normalization, so no window straddles a train/val/test boundary and no
    statistic is computed across splits.
  - Normalization statistics (mean/std per channel) are fit ONLY on the
    training split's observed values, then applied unchanged to val/test.
    This is the explicit anti-leakage requirement from the brief.
  - context_length / prediction_length are read from config, never
    hardcoded (item 11 of the brief).
"""
from __future__ import annotations

import dataclasses
from typing import Optional

import numpy as np
import torch
from torch.utils.data import Dataset

from diffusion.data.synthetic import SyntheticDataset, CHANNEL_ORDER


@dataclasses.dataclass
class Normalizer:
    mean: np.ndarray  # (num_channels,)
    std: np.ndarray   # (num_channels,)

    @classmethod
    def fit(cls, values: np.ndarray, mask: np.ndarray) -> "Normalizer":
        """Fit per-channel mean/std using only observed (mask==1) entries."""
        num_channels = values.shape[-1]
        mean = np.zeros(num_channels, dtype=np.float64)
        std = np.ones(num_channels, dtype=np.float64)
        flat_values = values.reshape(-1, num_channels)
        flat_mask = mask.reshape(-1, num_channels)
        for c in range(num_channels):
            observed = flat_values[flat_mask[:, c] == 1.0, c]
            observed = observed[~np.isnan(observed)]
            if len(observed) == 0:
                continue
            mean[c] = observed.mean()
            std[c] = observed.std()
            if std[c] < 1e-6:
                std[c] = 1.0
        return cls(mean=mean.astype(np.float32), std=std.astype(np.float32))

    def transform(self, values: np.ndarray) -> np.ndarray:
        return (values - self.mean) / self.std

    def inverse_transform(self, values: np.ndarray) -> np.ndarray:
        return values * self.std + self.mean

    def to_dict(self) -> dict:
        return {"mean": self.mean.tolist(), "std": self.std.tolist(), "channels": list(CHANNEL_ORDER)}

    @classmethod
    def from_dict(cls, d: dict) -> "Normalizer":
        return cls(mean=np.array(d["mean"], dtype=np.float32), std=np.array(d["std"], dtype=np.float32))


def split_dataset(dataset: SyntheticDataset, train_frac: float, val_frac: float, test_frac: float, seed: int):
    """Sequence-level split (never split within a sequence) to avoid leakage."""
    n = dataset.values.shape[0]
    rng = np.random.default_rng(seed)
    idx = rng.permutation(n)

    n_train = int(round(n * train_frac))
    n_val = int(round(n * val_frac))
    train_idx = idx[:n_train]
    val_idx = idx[n_train : n_train + n_val]
    test_idx = idx[n_train + n_val :]

    def _subset(indices):
        return SyntheticDataset(
            values=dataset.values[indices],
            mask=dataset.mask[indices],
            timestamps=dataset.timestamps[indices],
            channel_order=dataset.channel_order,
        )

    return _subset(train_idx), _subset(val_idx), _subset(test_idx)


def make_windows(dataset: SyntheticDataset, context_length: int, prediction_length: int, stride: int = 1):
    """Slide a fixed-size window over every sequence.

    Returns (values, mask) arrays of shape (num_windows, L, C), where
    L = context_length + prediction_length. Sequences shorter than L are
    skipped (with a warning) rather than padded, to avoid inventing data.
    """
    L = context_length + prediction_length
    values_out, mask_out = [], []
    for seq_values, seq_mask in zip(dataset.values, dataset.mask):
        seq_len = seq_values.shape[0]
        if seq_len < L:
            continue
        for start in range(0, seq_len - L + 1, stride):
            values_out.append(seq_values[start : start + L])
            mask_out.append(seq_mask[start : start + L])
    if not values_out:
        raise ValueError(
            f"No windows produced: every sequence is shorter than context_length+prediction_length={L}. "
            "Reduce context_length/prediction_length or increase synthetic sequence_length."
        )
    return np.stack(values_out), np.stack(mask_out)


class WindowDataset(Dataset):
    """Produces (observed_values, cond_mask, target_mask, gt_values) tuples.

    Training strategy follows CSDI's self-supervised masking scheme:
      - The prediction-length tail is always excluded from conditioning
        (this is what makes the SAME model do forecasting: the "future" is
        just additional unobserved positions).
      - A configurable fraction of the OBSERVED context points is also
        randomly held out from conditioning each time a sample is drawn;
        the loss is computed only where a real observed value exists
        (target_mask == 1), never on truly-missing (unobserved-in-source)
        positions, since no ground truth exists for those.
    """

    def __init__(
        self,
        dataset: SyntheticDataset,
        normalizer: Normalizer,
        context_length: int,
        prediction_length: int,
        artificial_mask_ratio: float,
        stride: int = 1,
        deterministic: bool = False,
        seed: int = 0,
    ):
        raw_values, raw_mask = make_windows(dataset, context_length, prediction_length, stride)
        filled = np.nan_to_num(raw_values, nan=0.0)
        self.values = normalizer.transform(filled).astype(np.float32)
        self.mask = raw_mask.astype(np.float32)
        self.context_length = context_length
        self.prediction_length = prediction_length
        self.artificial_mask_ratio = artificial_mask_ratio
        self.deterministic = deterministic
        self.seed = seed

    def __len__(self) -> int:
        return self.values.shape[0]

    def __getitem__(self, index: int):
        values = self.values[index]  # (L, C)
        mask = self.mask[index]      # (L, C)
        L, C = mask.shape

        rng = np.random.default_rng(self.seed + index) if self.deterministic else np.random.default_rng()

        cond_mask = mask.copy()
        # Forecasting: the whole prediction-length tail is unobserved to the model.
        cond_mask[self.context_length :, :] = 0.0
        # Imputation self-supervision: randomly hide a fraction of the
        # observed context points too, so the model learns to reconstruct
        # from partial context exactly like it will see at inference.
        holdout = (rng.random((self.context_length, C)) < self.artificial_mask_ratio) & (
            mask[: self.context_length] == 1.0
        )
        cond_mask[: self.context_length][holdout] = 0.0

        target_mask = mask - cond_mask  # only originally-observed points that are hidden from conditioning

        return (
            torch.from_numpy(values),
            torch.from_numpy(cond_mask),
            torch.from_numpy(target_mask),
            torch.from_numpy(values),  # ground truth values (already normalized); scored only where target_mask==1
        )
