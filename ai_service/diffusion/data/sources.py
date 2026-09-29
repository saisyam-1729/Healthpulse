"""Single entry point for turning `data` config into sequences (synthetic or real)."""
from __future__ import annotations

import os

from diffusion.data.synthetic import SyntheticDataset, generate_from_config

_AI_SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def load_sequences(data_cfg) -> SyntheticDataset:
    if data_cfg.source == "synthetic":
        return generate_from_config(data_cfg)
    if data_cfg.source == "noneeg":
        from diffusion.data.noneeg import load_noneeg

        real = data_cfg.real or {}
        data_dir = real.get("data_dir", "data/raw/noneeg")
        if not os.path.isabs(data_dir):
            data_dir = os.path.join(_AI_SERVICE_DIR, data_dir)
        if not os.path.isdir(data_dir):
            raise FileNotFoundError(
                f"Non-EEG data not found at {data_dir}. Download it from "
                "https://physionet.org/content/noneeg/1.0.0/ (see README)."
            )
        return load_noneeg(data_dir, step_seconds=real.get("step_seconds", 5))
    raise ValueError(f"unknown data.source '{data_cfg.source}'")
