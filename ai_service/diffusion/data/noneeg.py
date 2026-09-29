"""Loader for the PhysioNet "Non-EEG Dataset for Assessment of Neurological Status" v1.0.0.

https://physionet.org/content/noneeg/1.0.0/  (ODC Attribution License 1.0; cite the dataset
and PhysioNet when publishing results). 20 healthy subjects, ~38 min each, wrist sensors,
protocol of relaxation / physical / cognitive / emotional stress.

Each subject has two WFDB records with no stored start time:
  SubjectN_SpO2HR     2 signals (SpO2 %, hr bpm) at 1 Hz
  SubjectN_AccTempEDA 5 signals (ax, ay, az, temp degC, EDA) at 8 Hz
Their lengths agree to within a few seconds, so both are assumed to start together.

Output matches the synthetic generator's SyntheticDataset: one sequence per subject in
CHANNEL_ORDER, averaged into `step_seconds` bins to match the model's sampling grid.
The recordings contain no missing values; missingness is introduced by the eval masks.
Temperature here is wrist SKIN temperature (about 25-36 degC), not the core-like range the
synthetic generator uses, which is a real domain shift.
"""
from __future__ import annotations

import os
import re

import numpy as np

from diffusion.data.synthetic import CHANNEL_ORDER, SyntheticDataset

_SIGNAL_SPEC = re.compile(r"([-\d.eE+]+)\(([-\d]+)\)/(\S+)")


def read_wfdb(path_without_ext: str) -> tuple[float, dict]:
    """Minimal reader for single-file WFDB format-16 records. Returns (fs, {name: physical})."""
    with open(path_without_ext + ".hea", encoding="utf-8") as f:
        lines = [line for line in f if line.strip() and not line.startswith("#")]
    head = lines[0].split()
    num_signals, fs = int(head[1]), float(head[2])
    specs = []
    for line in lines[1 : 1 + num_signals]:
        parts = line.split()
        if parts[1] != "16":
            raise ValueError(f"unsupported WFDB format {parts[1]} in {path_without_ext}")
        m = _SIGNAL_SPEC.match(parts[2])
        if not m:
            raise ValueError(f"cannot parse gain/baseline '{parts[2]}' in {path_without_ext}")
        specs.append((parts[-1], float(m.group(1)), int(m.group(2))))
    raw = np.fromfile(path_without_ext + ".dat", dtype="<i2").astype(np.float64)
    raw = raw[: (len(raw) // num_signals) * num_signals].reshape(-1, num_signals)
    return fs, {name: (raw[:, i] - baseline) / gain for i, (name, gain, baseline) in enumerate(specs)}


def _block_mean(x: np.ndarray, size: int) -> np.ndarray:
    n = (len(x) // size) * size
    return x[:n].reshape(-1, size).mean(axis=1)


def load_subject(data_dir: str, subject: int, step_seconds: int = 5) -> np.ndarray:
    """(steps, 3) array in CHANNEL_ORDER for one subject."""
    fs1, vitals = read_wfdb(os.path.join(data_dir, f"Subject{subject}_SpO2HR"))
    fs2, other = read_wfdb(os.path.join(data_dir, f"Subject{subject}_AccTempEDA"))
    hr = _block_mean(vitals["hr"], int(round(fs1)))          # already 1 Hz
    spo2 = _block_mean(vitals["SpO2"], int(round(fs1)))
    temp = _block_mean(other["temp"], int(round(fs2)))        # 8 Hz -> 1 Hz
    n = min(len(hr), len(spo2), len(temp))
    per_second = {"heartRate": hr[:n], "spo2": spo2[:n], "temperature": temp[:n]}
    return np.stack([_block_mean(per_second[c], step_seconds) for c in CHANNEL_ORDER], axis=-1)


def load_noneeg(data_dir: str, step_seconds: int = 5, subjects=None) -> SyntheticDataset:
    """All subjects, truncated to the shortest recording so they stack into one array."""
    subjects = list(subjects) if subjects is not None else list(range(1, 21))
    seqs = [load_subject(data_dir, s, step_seconds) for s in subjects]
    length = min(len(s) for s in seqs)
    values = np.stack([s[:length] for s in seqs]).astype(np.float32)
    mask = np.isfinite(values).astype(np.float32)
    values = np.where(mask == 1.0, values, np.nan).astype(np.float32)
    timestamps = np.tile(np.arange(length, dtype=np.float64) * step_seconds, (len(seqs), 1))
    return SyntheticDataset(values=values, mask=mask, timestamps=timestamps)
