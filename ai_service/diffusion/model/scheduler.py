"""Gaussian diffusion forward/reverse process (DDPM), conditioned via masking.

Mathematical summary (expanded further in docs/IMPLEMENTATION_REPORT.md
once written):

Forward process (noising), for diffusion step t in [1, T]:
    x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * eps,   eps ~ N(0, I)
This has a closed form (no need to iterate step by step) because the
Gaussian forward process is Markovian with known per-step variance `beta_t`.

Reverse process (denoising), learned by the network `eps_theta`:
    x_{t-1} = 1/sqrt(alpha_t) * (x_t - beta_t/sqrt(1-alpha_bar_t) * eps_theta(x_t, t, cond))
              + sigma_t * z,   z ~ N(0, I) if t > 0 else 0
The network is trained to predict the noise `eps` that was added, which is
mathematically equivalent to predicting a denoised x_0 (standard DDPM
reparameterization).

Conditioning (the CSDI-style adaptation, see docs/MODEL_SELECTION.md): the
forward/reverse process only ever operates on positions marked unobserved
by `cond_mask`. Observed positions are passed to the network as a separate
"cond_value" input at every step and are never noised — the model learns to
fill in the rest consistently with what it's told is already known.
"""
from __future__ import annotations

import dataclasses

import torch


@dataclasses.dataclass
class BetaScheduleConfig:
    diffusion_steps: int
    beta_start: float
    beta_end: float
    schedule: str  # 'linear' or 'quad'


def make_beta_schedule(cfg: BetaScheduleConfig) -> torch.Tensor:
    if cfg.schedule == "linear":
        return torch.linspace(cfg.beta_start, cfg.beta_end, cfg.diffusion_steps)
    if cfg.schedule == "quad":
        return (
            torch.linspace(cfg.beta_start**0.5, cfg.beta_end**0.5, cfg.diffusion_steps) ** 2
        )
    raise ValueError(f"unknown schedule '{cfg.schedule}'")


class GaussianDiffusion:
    def __init__(self, cfg: BetaScheduleConfig, device: torch.device):
        self.T = cfg.diffusion_steps
        betas = make_beta_schedule(cfg).to(device)
        alphas = 1.0 - betas
        alpha_bars = torch.cumprod(alphas, dim=0)

        self.betas = betas
        self.alphas = alphas
        self.alpha_bars = alpha_bars
        self.device = device

    def q_sample(self, x0: torch.Tensor, t: torch.Tensor, noise: torch.Tensor) -> torch.Tensor:
        """Closed-form forward noising: sample x_t given x_0 directly (no loop)."""
        sqrt_ab = self.alpha_bars[t].sqrt().view(-1, 1, 1)
        sqrt_one_minus_ab = (1 - self.alpha_bars[t]).sqrt().view(-1, 1, 1)
        return sqrt_ab * x0 + sqrt_one_minus_ab * noise

    def training_loss(
        self,
        denoiser: torch.nn.Module,
        x0: torch.Tensor,          # (B, L, C) normalized ground-truth values (0-filled where truly unknown)
        cond_mask: torch.Tensor,   # (B, L, C) 1 = given to the model as known context
        target_mask: torch.Tensor,  # (B, L, C) 1 = score the loss here (subset of ~cond_mask with real ground truth)
        fourier_loss_weight: float = 0.0,
    ) -> torch.Tensor:
        B = x0.shape[0]
        t = torch.randint(0, self.T, (B,), device=x0.device)
        noise = torch.randn_like(x0)

        x_t = self.q_sample(x0, t, noise)
        cond_value = x0 * cond_mask
        noisy_input = x_t * (1 - cond_mask)  # network never sees ground truth at unconditioned cells directly

        eps_pred = denoiser(noisy_input, cond_value, t)

        denom = target_mask.sum().clamp_min(1.0)
        mse = ((eps_pred - noise) ** 2 * target_mask).sum() / denom

        if fourier_loss_weight > 0:
            # Reconstruct an x0 estimate to compare frequency content — a
            # small regularizer (borrowed from Diffusion-TS, see
            # docs/DIFFUSION_RESEARCH.md) discouraging unphysiological
            # high-frequency artifacts in the denoised signal.
            sqrt_ab = self.alpha_bars[t].sqrt().view(-1, 1, 1)
            sqrt_one_minus_ab = (1 - self.alpha_bars[t]).sqrt().view(-1, 1, 1)
            x0_hat = (x_t - sqrt_one_minus_ab * eps_pred) / sqrt_ab.clamp_min(1e-4)
            pred_fft = torch.fft.rfft(x0_hat * target_mask, dim=1).abs()
            true_fft = torch.fft.rfft(x0 * target_mask, dim=1).abs()
            fourier_loss = ((pred_fft - true_fft) ** 2).mean()
            mse = mse + fourier_loss_weight * fourier_loss

        return mse

    @torch.no_grad()
    def sample(
        self,
        denoiser: torch.nn.Module,
        x0_known: torch.Tensor,   # (B, L, C) normalized values, meaningful only where cond_mask==1
        cond_mask: torch.Tensor,  # (B, L, C)
        num_samples: int = 1,
        sampling_steps: int | None = None,
    ) -> torch.Tensor:
        """Draw `num_samples` independent reverse-diffusion samples.

        Returns (num_samples, B, L, C). Conditioned positions are held
        fixed at their known value throughout, matching x0_known exactly in
        the output (they are never actually generated).
        """
        denoiser.eval()
        steps = sampling_steps or self.T
        stride = max(1, self.T // steps)
        timesteps = list(range(self.T - 1, -1, -stride))

        cond_value = x0_known * cond_mask
        B, L, C = x0_known.shape
        draws = []

        for _ in range(num_samples):
            current = torch.randn(B, L, C, device=x0_known.device)
            for t in timesteps:
                t_batch = torch.full((B,), t, device=x0_known.device, dtype=torch.long)
                noisy_input = current * (1 - cond_mask)
                eps_pred = denoiser(noisy_input, cond_value, t_batch)

                alpha_t = self.alphas[t]
                alpha_bar_t = self.alpha_bars[t]
                beta_t = self.betas[t]

                mean = (1.0 / alpha_t.sqrt()) * (
                    current - (beta_t / (1 - alpha_bar_t).sqrt()) * eps_pred
                )
                if t > 0:
                    noise = torch.randn_like(current)
                    sigma = beta_t.sqrt()
                    current = mean + sigma * noise
                else:
                    current = mean

                # Conditioned positions are re-fixed to their known value at
                # every step so the model always conditions on the true
                # observation, never its own noisy estimate of it.
                current = current * (1 - cond_mask) + cond_value

            draws.append(current)

        denoiser.train()
        return torch.stack(draws, dim=0)
