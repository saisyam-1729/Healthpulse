"""CSDI-lite denoising network.

Adapted from CSDI (Tashiro et al., NeurIPS 2021) and scaled down for
HealthPulse's 3-channel, short-window setting (see docs/MODEL_SELECTION.md
section 3 for the specific adaptation rationale). Kept: mask-conditioned
input construction, diffusion-step embedding, alternating attention across
the time axis and the feature (channel) axis. Dropped relative to the
official implementation: the larger hidden dims and layer counts tuned for
PhysioNet's dozens of channels, which would be over-parameterized here.

Each (time, channel) cell of the window is a token. Its input is built from
two scalars — the conditioning value (observed value if given as context,
else 0) and the current noisy value being denoised — plus additive side
information (diffusion-step embedding, sinusoidal time-position embedding,
and a learned per-channel embedding). Attention then alternates between
mixing information across TIME (within a channel) and across CHANNELS
(within a timestep), matching CSDI's two-stage transformer design.
"""
from __future__ import annotations

import torch
import torch.nn as nn

from diffusion.model.embeddings import sinusoidal_embedding


class _AxisTransformerLayer(nn.Module):
    """One self-attention block applied along a chosen axis, shared across the other."""

    def __init__(self, hidden_dim: int, num_heads: int, dropout: float):
        super().__init__()
        self.encoder = nn.TransformerEncoderLayer(
            d_model=hidden_dim,
            nhead=num_heads,
            dim_feedforward=hidden_dim * 2,
            dropout=dropout,
            batch_first=True,
            activation="gelu",
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq, hidden_dim)
        return self.encoder(x)


class CSDILiteDenoiser(nn.Module):
    def __init__(
        self,
        num_channels: int,
        hidden_dim: int = 64,
        time_embed_dim: int = 32,
        feature_embed_dim: int = 16,
        num_layers: int = 4,
        num_heads: int = 4,
        dropout: float = 0.1,
        diffusion_steps: int = 50,
    ):
        super().__init__()
        self.num_channels = num_channels
        self.hidden_dim = hidden_dim
        self.time_embed_dim = time_embed_dim
        self.diffusion_steps = diffusion_steps

        self.input_proj = nn.Linear(2, hidden_dim)  # [cond_value, noisy_value] per cell

        side_dim = time_embed_dim + time_embed_dim + feature_embed_dim
        self.side_proj = nn.Linear(side_dim, hidden_dim)
        self.feature_embed = nn.Embedding(num_channels, feature_embed_dim)

        self.diffusion_mlp = nn.Sequential(
            nn.Linear(time_embed_dim, time_embed_dim),
            nn.SiLU(),
            nn.Linear(time_embed_dim, time_embed_dim),
        )

        self.temporal_layers = nn.ModuleList(
            [_AxisTransformerLayer(hidden_dim, num_heads, dropout) for _ in range(num_layers)]
        )
        self.feature_layers = nn.ModuleList(
            [_AxisTransformerLayer(hidden_dim, num_heads, dropout) for _ in range(num_layers)]
        )

        self.output_proj = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, 1),
        )

    def forward(
        self,
        noisy_target: torch.Tensor,  # (B, L, C)
        cond_value: torch.Tensor,    # (B, L, C)
        diffusion_step: torch.Tensor,  # (B,)
    ) -> torch.Tensor:
        B, L, C = noisy_target.shape
        device = noisy_target.device

        cell_input = torch.stack([cond_value, noisy_target], dim=-1)  # (B, L, C, 2)
        h = self.input_proj(cell_input)  # (B, L, C, H)

        diff_emb = sinusoidal_embedding(diffusion_step, self.time_embed_dim)  # (B, time_embed_dim)
        diff_emb = self.diffusion_mlp(diff_emb)
        diff_emb = diff_emb[:, None, None, :].expand(B, L, C, self.time_embed_dim)

        time_idx = torch.arange(L, device=device)
        time_emb = sinusoidal_embedding(time_idx, self.time_embed_dim)  # (L, time_embed_dim)
        time_emb = time_emb[None, :, None, :].expand(B, L, C, self.time_embed_dim)

        feat_idx = torch.arange(C, device=device)
        feat_emb = self.feature_embed(feat_idx)  # (C, feature_embed_dim)
        feat_emb = feat_emb[None, None, :, :].expand(B, L, C, feat_emb.shape[-1])

        side = torch.cat([diff_emb, time_emb, feat_emb], dim=-1)
        h = h + self.side_proj(side)  # (B, L, C, H)

        for temporal_layer, feature_layer in zip(self.temporal_layers, self.feature_layers):
            # Attend across TIME: fold channels into the batch dim.
            h_t = h.permute(0, 2, 1, 3).reshape(B * C, L, self.hidden_dim)
            h_t = temporal_layer(h_t)
            h = h_t.reshape(B, C, L, self.hidden_dim).permute(0, 2, 1, 3)

            # Attend across FEATURES (channels): fold time into the batch dim.
            h_f = h.reshape(B * L, C, self.hidden_dim)
            h_f = feature_layer(h_f)
            h = h_f.reshape(B, L, C, self.hidden_dim)

        out = self.output_proj(h).squeeze(-1)  # (B, L, C)
        return out
