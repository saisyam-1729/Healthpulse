"""Sinusoidal embeddings shared by the diffusion-step and time-position encodings.

Same construction used in the original DDPM/Transformer positional encoding
and reused (as documented in docs/DIFFUSION_RESEARCH.md) for the CSDI-style
denoiser's diffusion-timestep embedding and its within-window time-position
embedding.
"""
from __future__ import annotations

import math

import torch


def sinusoidal_embedding(indices: torch.Tensor, dim: int) -> torch.Tensor:
    """indices: (...,) long/float tensor. Returns (..., dim) float tensor."""
    if dim % 2 != 0:
        raise ValueError("embedding dim must be even")
    half = dim // 2
    freqs = torch.exp(
        -math.log(10000.0) * torch.arange(0, half, device=indices.device, dtype=torch.float32) / half
    )
    args = indices.float().unsqueeze(-1) * freqs  # (..., half)
    return torch.cat([torch.sin(args), torch.cos(args)], dim=-1)
