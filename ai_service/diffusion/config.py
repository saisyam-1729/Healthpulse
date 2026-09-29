"""Centralized configuration loading for the diffusion component.

All model dimensions, sequence lengths, and hyperparameters live in
configs/diffusion.yaml (see docs/MODEL_SELECTION.md and item 21 of the
implementation brief: "Do not scatter magic numbers throughout source
code."). This module is the single place that reads that file.
"""
from __future__ import annotations

import dataclasses
import os
from typing import Any, Optional

import yaml

_DEFAULT_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "configs", "diffusion.yaml"
)


@dataclasses.dataclass
class DataConfig:
    channels: list
    context_length: int
    prediction_length: int
    synthetic: dict


@dataclasses.dataclass
class SplitConfig:
    train_frac: float
    val_frac: float
    test_frac: float
    seed: int


@dataclasses.dataclass
class ModelConfig:
    name: str
    hidden_dim: int
    time_embed_dim: int
    feature_embed_dim: int
    num_layers: int
    num_heads: int
    dropout: float
    diffusion_steps: int
    beta_start: float
    beta_end: float
    schedule: str
    use_fourier_loss: bool
    fourier_loss_weight: float


@dataclasses.dataclass
class TrainingConfig:
    seed: int
    batch_size: int
    epochs: int
    learning_rate: float
    lr_scheduler: str
    warmup_epochs: int
    grad_clip_norm: float
    early_stopping_patience: int
    mixed_precision: bool
    checkpoint_dir: str
    resume_from: Optional[str]
    device: str
    num_workers: int


@dataclasses.dataclass
class InferenceConfig:
    num_samples: int
    sampling_steps: int
    batch_size: int
    timeout_seconds: int
    device: str


@dataclasses.dataclass
class EvaluationConfig:
    artificial_mask_ratio: float
    prediction_interval: float


@dataclasses.dataclass
class DiffusionConfig:
    data: DataConfig
    split: SplitConfig
    model: ModelConfig
    training: TrainingConfig
    inference: InferenceConfig
    evaluation: EvaluationConfig
    _path: str = ""

    @property
    def num_channels(self) -> int:
        return len(self.data.channels)


def load_config(path: Optional[str] = None) -> DiffusionConfig:
    """Load and validate the diffusion YAML config.

    `path` defaults to ai_service/configs/diffusion.yaml. An environment
    variable DIFFUSION_CONFIG_PATH overrides the default when `path` is
    not explicitly given (used by the Flask service at startup).
    """
    resolved = path or os.environ.get("DIFFUSION_CONFIG_PATH", _DEFAULT_CONFIG_PATH)
    with open(resolved, "r", encoding="utf-8") as f:
        raw: dict[str, Any] = yaml.safe_load(f)

    cfg = DiffusionConfig(
        data=DataConfig(**raw["data"]),
        split=SplitConfig(**raw["split"]),
        model=ModelConfig(**raw["model"]),
        training=TrainingConfig(**raw["training"]),
        inference=InferenceConfig(**raw["inference"]),
        evaluation=EvaluationConfig(**raw["evaluation"]),
        _path=resolved,
    )
    _validate(cfg)
    return cfg


def _validate(cfg: DiffusionConfig) -> None:
    if cfg.data.context_length <= 0 or cfg.data.prediction_length < 0:
        raise ValueError("context_length must be > 0 and prediction_length must be >= 0")
    total_frac = cfg.split.train_frac + cfg.split.val_frac + cfg.split.test_frac
    if abs(total_frac - 1.0) > 1e-6:
        raise ValueError(f"split fractions must sum to 1.0, got {total_frac}")
    if cfg.model.schedule not in ("linear", "quad"):
        raise ValueError(f"unknown beta schedule '{cfg.model.schedule}'")
    if not (0.0 < cfg.model.beta_start < cfg.model.beta_end < 1.0):
        raise ValueError("require 0 < beta_start < beta_end < 1")
