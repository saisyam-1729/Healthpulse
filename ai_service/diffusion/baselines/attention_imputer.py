"""Lightweight SAITS-inspired deterministic imputation baseline.

Not a port of the official SAITS implementation — a small self-attention
network in the same spirit (mask-conditioned attention, single forward
pass, deterministic point output, no diffusion) so the diffusion model has
a genuine learned baseline to beat, not just persistence/interpolation.
Unlike the diffusion model, this produces ONE point estimate per cell, no
uncertainty.
"""
from __future__ import annotations

import torch
import torch.nn as nn

from diffusion.model.embeddings import sinusoidal_embedding


class AttentionImputer(nn.Module):
    def __init__(self, num_channels: int, hidden_dim: int = 64, num_layers: int = 2, num_heads: int = 4, dropout: float = 0.1):
        super().__init__()
        self.num_channels = num_channels
        self.hidden_dim = hidden_dim
        self.input_proj = nn.Linear(2, hidden_dim)  # [masked_value, mask_indicator]
        self.time_embed_dim = hidden_dim
        self.feature_embed = nn.Embedding(num_channels, hidden_dim)

        self.layers = nn.ModuleList(
            [
                nn.TransformerEncoderLayer(
                    d_model=hidden_dim, nhead=num_heads, dim_feedforward=hidden_dim * 2,
                    dropout=dropout, batch_first=True, activation="gelu",
                )
                for _ in range(num_layers)
            ]
        )
        self.output_proj = nn.Linear(hidden_dim, 1)

    def forward(self, values: torch.Tensor, cond_mask: torch.Tensor) -> torch.Tensor:
        B, L, C = values.shape
        device = values.device
        masked_value = values * cond_mask
        cell_input = torch.stack([masked_value, cond_mask], dim=-1)
        h = self.input_proj(cell_input)  # (B, L, C, H)

        time_idx = torch.arange(L, device=device)
        time_emb = sinusoidal_embedding(time_idx, self.time_embed_dim)[None, :, None, :]
        feat_emb = self.feature_embed(torch.arange(C, device=device))[None, None, :, :]
        h = h + time_emb + feat_emb

        h = h.reshape(B, L * C, self.hidden_dim)
        for layer in self.layers:
            h = layer(h)
        h = h.reshape(B, L, C, self.hidden_dim)

        return self.output_proj(h).squeeze(-1)  # (B, L, C) direct value prediction


def training_loss(model: AttentionImputer, values: torch.Tensor, cond_mask: torch.Tensor, target_mask: torch.Tensor) -> torch.Tensor:
    pred = model(values, cond_mask)
    denom = target_mask.sum().clamp_min(1.0)
    return ((pred - values) ** 2 * target_mask).sum() / denom
