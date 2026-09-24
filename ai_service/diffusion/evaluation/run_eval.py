"""Evaluate the trained diffusion model against the mandatory non-diffusion
baselines (implementation brief, item 14) on the held-out test split.

Usage (from ai_service/):
    python -m diffusion.evaluation.run_eval --config configs/diffusion_dev.yaml \
        --checkpoint checkpoints_dev/best.pt --output checkpoints_dev/eval_results.json

Reports MAE/RMSE/MAPE/sMAPE for every method, plus CRPS and 90% interval
coverage for the diffusion model (the only method here that is genuinely
probabilistic). Also runs the physiological-validity sanity checks on the
diffusion model's output.

All numbers come from an actual run against the SAME held-out test windows
for every method — no number here is estimated or asserted without this
script actually being executed (brief item 38).
"""
from __future__ import annotations

import argparse
import json

import numpy as np
import torch
from torch.utils.data import DataLoader

from diffusion.baselines.attention_imputer import AttentionImputer, training_loss as attn_training_loss
from diffusion.baselines.simple import persistence_baseline, linear_interpolation_baseline, mean_baseline
from diffusion.config import load_config
from diffusion.data.synthetic import generate_from_config
from diffusion.data.preprocessing import Normalizer, split_dataset, WindowDataset
from diffusion.evaluation.metrics import summarize, physiological_validity_report
from diffusion.model.csdi import DiffusionModel
from diffusion.training.train import set_seed, resolve_device


def _train_attention_baseline(train_ds, config, device, epochs: int = 5) -> AttentionImputer:
    model = AttentionImputer(num_channels=len(config.data.channels), hidden_dim=32, num_layers=2, num_heads=4).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    loader = DataLoader(train_ds, batch_size=config.training.batch_size, shuffle=True)
    for epoch in range(epochs):
        for values, cond_mask, target_mask, gt in loader:
            values, cond_mask, target_mask = values.to(device), cond_mask.to(device), target_mask.to(device)
            optimizer.zero_grad()
            loss = attn_training_loss(model, values, cond_mask, target_mask)
            loss.backward()
            optimizer.step()
    model.eval()
    return model


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, required=True)
    parser.add_argument("--checkpoint", type=str, required=True)
    parser.add_argument("--output", type=str, default=None)
    parser.add_argument(
        "--max-test-windows", type=int, default=None,
        help="Randomly subsample the test split to this many windows (turnaround-time control for CPU runs). "
             "The actual count used is always reported in the output JSON.",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    set_seed(config.training.seed)
    device = resolve_device(config.training.device)

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
    test_ds = WindowDataset(test_seq, normalizer, deterministic=True, seed=99, **common)

    if args.max_test_windows is not None and len(test_ds) > args.max_test_windows:
        rng = np.random.default_rng(123)
        keep_idx = rng.choice(len(test_ds), size=args.max_test_windows, replace=False)
        test_ds = torch.utils.data.Subset(test_ds, keep_idx.tolist())

    diffusion_model = DiffusionModel.load_checkpoint(args.checkpoint, device)
    attn_model = _train_attention_baseline(train_ds, config, device)

    channel_means = np.zeros(len(config.data.channels), dtype=np.float32)  # normalized space -> ~0 by construction

    all_pred = {"diffusion": [], "persistence": [], "linear_interpolation": [], "mean": [], "attention_imputer": []}
    all_true, all_target_mask = [], []
    all_diffusion_samples = []

    test_loader = DataLoader(test_ds, batch_size=config.inference.batch_size, shuffle=False)

    with torch.no_grad():
        for values, cond_mask, target_mask, gt in test_loader:
            values_d, cond_mask_d = values.to(device), cond_mask.to(device)
            samples = diffusion_model.sample(
                values_d, cond_mask_d,
                num_samples=config.inference.num_samples, sampling_steps=config.inference.sampling_steps,
            )  # (S, B, L, C)
            diffusion_mean = samples.mean(dim=0).cpu().numpy()
            all_diffusion_samples.append(samples.cpu().numpy())
            all_pred["diffusion"].append(diffusion_mean)

            attn_pred = attn_model(values_d, cond_mask_d).cpu().numpy()
            all_pred["attention_imputer"].append(attn_pred)

            values_np, cond_mask_np, target_mask_np, gt_np = (
                values.numpy(), cond_mask.numpy(), target_mask.numpy(), gt.numpy(),
            )
            batch_persistence, batch_interp, batch_mean = [], [], []
            for i in range(values_np.shape[0]):
                batch_persistence.append(persistence_baseline(values_np[i], cond_mask_np[i]))
                batch_interp.append(linear_interpolation_baseline(values_np[i], cond_mask_np[i]))
                batch_mean.append(mean_baseline(values_np[i], cond_mask_np[i], channel_means))
            all_pred["persistence"].append(np.stack(batch_persistence))
            all_pred["linear_interpolation"].append(np.stack(batch_interp))
            all_pred["mean"].append(np.stack(batch_mean))

            all_true.append(gt_np)
            all_target_mask.append(target_mask_np)

    true = np.concatenate(all_true, axis=0)
    target_mask = np.concatenate(all_target_mask, axis=0)
    diffusion_samples = np.concatenate(all_diffusion_samples, axis=1)  # (S, N, L, C)

    results = {"num_test_windows": int(true.shape[0]), "context_length": config.data.context_length,
               "prediction_length": config.data.prediction_length}
    for method, chunks in all_pred.items():
        pred = np.concatenate(chunks, axis=0)
        if method == "diffusion":
            results[method] = summarize(pred, true, target_mask, samples=diffusion_samples, prediction_interval=config.evaluation.prediction_interval)
        else:
            results[method] = summarize(pred, true, target_mask)

    # Physiological validity check on the diffusion model's denormalized output.
    diffusion_pred_denorm = normalizer.inverse_transform(np.concatenate(all_pred["diffusion"], axis=0))
    results["diffusion_physiological_validity"] = physiological_validity_report(diffusion_pred_denorm)

    print(json.dumps(results, indent=2))
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"\nWrote {args.output}")


if __name__ == "__main__":
    main()
