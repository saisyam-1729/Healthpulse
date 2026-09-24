"""Top-level model wrapper: denoiser + diffusion process + normalizer, bundled
for training, checkpointing, and inference as a single unit.
"""
from __future__ import annotations

import dataclasses
from typing import Optional

import torch

from diffusion.config import DiffusionConfig
from diffusion.data.preprocessing import Normalizer
from diffusion.model.denoiser import CSDILiteDenoiser
from diffusion.model.scheduler import BetaScheduleConfig, GaussianDiffusion


class DiffusionModel:
    def __init__(self, config: DiffusionConfig, normalizer: Normalizer, device: torch.device):
        self.config = config
        self.normalizer = normalizer
        self.device = device

        self.denoiser = CSDILiteDenoiser(
            num_channels=config.num_channels,
            hidden_dim=config.model.hidden_dim,
            time_embed_dim=config.model.time_embed_dim,
            feature_embed_dim=config.model.feature_embed_dim,
            num_layers=config.model.num_layers,
            num_heads=config.model.num_heads,
            dropout=config.model.dropout,
            diffusion_steps=config.model.diffusion_steps,
        ).to(device)

        self.diffusion = GaussianDiffusion(
            BetaScheduleConfig(
                diffusion_steps=config.model.diffusion_steps,
                beta_start=config.model.beta_start,
                beta_end=config.model.beta_end,
                schedule=config.model.schedule,
            ),
            device=device,
        )

    def training_loss(self, x0, cond_mask, target_mask) -> torch.Tensor:
        return self.diffusion.training_loss(
            self.denoiser,
            x0,
            cond_mask,
            target_mask,
            fourier_loss_weight=self.config.model.fourier_loss_weight if self.config.model.use_fourier_loss else 0.0,
        )

    def sample(self, x0_known, cond_mask, num_samples: Optional[int] = None, sampling_steps: Optional[int] = None):
        return self.diffusion.sample(
            self.denoiser,
            x0_known,
            cond_mask,
            num_samples=num_samples or self.config.inference.num_samples,
            sampling_steps=sampling_steps or self.config.inference.sampling_steps,
        )

    def save_checkpoint(self, path: str, extra: Optional[dict] = None) -> None:
        payload = {
            "denoiser_state_dict": self.denoiser.state_dict(),
            "normalizer": self.normalizer.to_dict(),
            "config": dataclasses.asdict(self.config, dict_factory=lambda items: {k: v for k, v in items if k != "_path"}),
        }
        if extra:
            payload.update(extra)
        torch.save(payload, path)

    @classmethod
    def load_checkpoint(cls, path: str, device: torch.device) -> "DiffusionModel":
        payload = torch.load(path, map_location=device, weights_only=False)
        from diffusion.config import (
            DataConfig, SplitConfig, ModelConfig, TrainingConfig, InferenceConfig, EvaluationConfig,
        )
        c = payload["config"]
        config = DiffusionConfig(
            data=DataConfig(**c["data"]),
            split=SplitConfig(**c["split"]),
            model=ModelConfig(**c["model"]),
            training=TrainingConfig(**c["training"]),
            inference=InferenceConfig(**c["inference"]),
            evaluation=EvaluationConfig(**c["evaluation"]),
        )
        normalizer = Normalizer.from_dict(payload["normalizer"])
        model = cls(config, normalizer, device)
        model.denoiser.load_state_dict(payload["denoiser_state_dict"])
        return model
