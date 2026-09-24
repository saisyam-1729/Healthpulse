"""Reproducible training entrypoint.

Usage (from ai_service/):
    python -m diffusion.training.train --config configs/diffusion.yaml

Trains on the synthetic generator only (see docs/DATA_PIPELINE.md — no real
HealthPulse dataset is available yet; this is documented, not hidden).
Every hyperparameter comes from the YAML config, not from CLI flags or
hardcoded constants, per the implementation brief's "no magic numbers"
principle. CLI flags exist only for orchestration (--config path,
--resume override, --seed override for repeated smoke runs).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import time

import numpy as np
import torch
from torch.utils.data import DataLoader

from diffusion.config import load_config
from diffusion.data.synthetic import generate_from_config
from diffusion.data.preprocessing import Normalizer, split_dataset, WindowDataset
from diffusion.model.csdi import DiffusionModel


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def resolve_device(requested: str) -> torch.device:
    if requested == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return torch.device(requested)


def build_datasets(config):
    raw = generate_from_config(config.data)
    train_seq, val_seq, test_seq = split_dataset(
        raw, config.split.train_frac, config.split.val_frac, config.split.test_frac, config.split.seed
    )
    normalizer = Normalizer.fit(train_seq.values, train_seq.mask)

    common = dict(
        context_length=config.data.context_length,
        prediction_length=config.data.prediction_length,
        artificial_mask_ratio=config.evaluation.artificial_mask_ratio,
    )
    train_ds = WindowDataset(train_seq, normalizer, deterministic=False, **common)
    val_ds = WindowDataset(val_seq, normalizer, deterministic=True, seed=1, **common)
    test_ds = WindowDataset(test_seq, normalizer, deterministic=True, seed=2, **common)
    return train_ds, val_ds, test_ds, normalizer


@torch.no_grad()
def evaluate(model: DiffusionModel, loader: DataLoader, device: torch.device) -> float:
    total_loss, total_batches = 0.0, 0
    for values, cond_mask, target_mask, gt in loader:
        values, cond_mask, target_mask = values.to(device), cond_mask.to(device), target_mask.to(device)
        loss = model.training_loss(values, cond_mask, target_mask)
        total_loss += loss.item()
        total_batches += 1
    return total_loss / max(1, total_batches)


def train(config_path: str, resume_override: str | None = None, seed_override: int | None = None, epochs_override: int | None = None):
    config = load_config(config_path)
    seed = seed_override if seed_override is not None else config.training.seed
    set_seed(seed)
    device = resolve_device(config.training.device)

    train_ds, val_ds, test_ds, normalizer = build_datasets(config)
    train_loader = DataLoader(train_ds, batch_size=config.training.batch_size, shuffle=True, num_workers=config.training.num_workers)
    val_loader = DataLoader(val_ds, batch_size=config.training.batch_size, shuffle=False, num_workers=config.training.num_workers)

    model = DiffusionModel(config, normalizer, device)
    optimizer = torch.optim.Adam(model.denoiser.parameters(), lr=config.training.learning_rate)

    epochs = epochs_override if epochs_override is not None else config.training.epochs
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, epochs))

    start_epoch = 0
    best_val_loss = float("inf")
    patience_counter = 0

    resume_path = resume_override or config.training.resume_from
    if resume_path and os.path.exists(resume_path):
        checkpoint = torch.load(resume_path, map_location=device, weights_only=False)
        model.denoiser.load_state_dict(checkpoint["denoiser_state_dict"])
        if "optimizer_state_dict" in checkpoint:
            optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        start_epoch = checkpoint.get("epoch", 0) + 1
        best_val_loss = checkpoint.get("best_val_loss", float("inf"))
        print(f"Resumed from {resume_path} at epoch {start_epoch}")

    os.makedirs(config.training.checkpoint_dir, exist_ok=True)
    history = []

    for epoch in range(start_epoch, epochs):
        model.denoiser.train()
        epoch_loss, num_batches = 0.0, 0
        t0 = time.time()
        for values, cond_mask, target_mask, gt in train_loader:
            values, cond_mask, target_mask = values.to(device), cond_mask.to(device), target_mask.to(device)
            optimizer.zero_grad()
            loss = model.training_loss(values, cond_mask, target_mask)
            loss.backward()
            if config.training.grad_clip_norm:
                torch.nn.utils.clip_grad_norm_(model.denoiser.parameters(), config.training.grad_clip_norm)
            optimizer.step()
            epoch_loss += loss.item()
            num_batches += 1
        scheduler.step()

        train_loss = epoch_loss / max(1, num_batches)
        val_loss = evaluate(model, val_loader, device)
        elapsed = time.time() - t0
        history.append({"epoch": epoch, "train_loss": train_loss, "val_loss": val_loss, "seconds": elapsed})
        print(f"epoch {epoch:3d}  train_loss={train_loss:.5f}  val_loss={val_loss:.5f}  ({elapsed:.1f}s)")

        is_best = val_loss < best_val_loss
        if is_best:
            best_val_loss = val_loss
            patience_counter = 0
            model.save_checkpoint(
                os.path.join(config.training.checkpoint_dir, "best.pt"),
                extra={"epoch": epoch, "best_val_loss": best_val_loss, "optimizer_state_dict": optimizer.state_dict()},
            )
        else:
            patience_counter += 1

        model.save_checkpoint(
            os.path.join(config.training.checkpoint_dir, "last.pt"),
            extra={"epoch": epoch, "best_val_loss": best_val_loss, "optimizer_state_dict": optimizer.state_dict()},
        )

        if config.training.early_stopping_patience and patience_counter >= config.training.early_stopping_patience:
            print(f"Early stopping at epoch {epoch} (no improvement for {patience_counter} epochs)")
            break

    with open(os.path.join(config.training.checkpoint_dir, "history.json"), "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    return model, history


def main():
    parser = argparse.ArgumentParser(description="Train the HealthPulse diffusion model")
    parser.add_argument("--config", type=str, default=os.path.join(os.path.dirname(__file__), "..", "..", "configs", "diffusion.yaml"))
    parser.add_argument("--resume", type=str, default=None)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--epochs", type=int, default=None, help="override config epochs (useful for smoke tests)")
    args = parser.parse_args()
    train(args.config, resume_override=args.resume, seed_override=args.seed, epochs_override=args.epochs)


if __name__ == "__main__":
    main()
