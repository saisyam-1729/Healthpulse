"""Lightweight experiment registry (implementation brief, item 23).

One JSON file per experiment under ai_service/experiments/, recording what is
needed to reproduce and audit a run: id, date, git commit (and whether the
working tree was dirty), dataset descriptor, full model/training config, seed,
training/validation metrics, test metrics, and the checkpoint (path + sha256).

Deliberately no MLflow/W&B: the brief asks for a lightweight solution unless
the repo already uses one, and it does not.

Usage (from ai_service/), after training and evaluation:
    python -m diffusion.experiments --name full-100ep \
        --config configs/diffusion.yaml \
        --checkpoint-dir checkpoints \
        --eval checkpoints/eval_results.json
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import hashlib
import json
import os
import subprocess
import uuid
from typing import Optional

from diffusion.config import load_config

EXPERIMENTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "experiments")


def _git(*args: str) -> Optional[str]:
    try:
        out = subprocess.run(["git", *args], capture_output=True, text=True, check=True,
                             cwd=os.path.dirname(os.path.abspath(__file__)))
        return out.stdout.strip()
    except Exception:  # noqa: BLE001 - git may be unavailable; record None rather than fail
        return None


def _sha256(path: str) -> Optional[str]:
    if not os.path.exists(path):
        return None
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_json(path: Optional[str]):
    if not path or not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def record_experiment(
    name: str,
    config_path: str,
    checkpoint_dir: str,
    eval_results_path: Optional[str] = None,
    notes: str = "",
    output_dir: str = EXPERIMENTS_DIR,
) -> str:
    config = load_config(config_path)
    history = _load_json(os.path.join(checkpoint_dir, "history.json")) or []
    best = min(history, key=lambda h: h["val_loss"]) if history else None
    best_ckpt = os.path.join(checkpoint_dir, "best.pt")

    entry = {
        "experiment_id": f"{dt.datetime.now(dt.timezone.utc):%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}",
        "name": name,
        "recorded_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "git_commit": _git("rev-parse", "HEAD"),
        "git_dirty": bool(_git("status", "--porcelain")),
        "dataset": {
            "kind": "synthetic (ai_service/diffusion/data/synthetic.py) - NOT real patient data",
            "generator_settings": config.data.synthetic,
            "split": dataclasses.asdict(config.split),
            "channels": config.data.channels,
            "context_length": config.data.context_length,
            "prediction_length": config.data.prediction_length,
        },
        "model_config": dataclasses.asdict(config.model),
        "hyperparameters": dataclasses.asdict(config.training),
        "inference_config": dataclasses.asdict(config.inference),
        "random_seed": config.training.seed,
        "training": {
            "epochs_run": len(history),
            "best_epoch": best["epoch"] if best else None,
            "best_val_loss": best["val_loss"] if best else None,
            "final_train_loss": history[-1]["train_loss"] if history else None,
            "final_val_loss": history[-1]["val_loss"] if history else None,
            "total_train_seconds": round(sum(h.get("seconds", 0.0) for h in history), 1),
        },
        "test_metrics": _load_json(eval_results_path),
        "checkpoint": {"path": best_ckpt, "sha256": _sha256(best_ckpt)},
        "config_file": config_path,
        "notes": notes,
    }

    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, f"{entry['experiment_id']}_{name}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(entry, f, indent=2)
    return out_path


def main() -> None:
    p = argparse.ArgumentParser(description="Record a finished training/eval run in the experiment registry")
    p.add_argument("--name", required=True)
    p.add_argument("--config", required=True)
    p.add_argument("--checkpoint-dir", required=True)
    p.add_argument("--eval", default=None, help="path to eval_results.json")
    p.add_argument("--notes", default="")
    args = p.parse_args()
    print(record_experiment(args.name, args.config, args.checkpoint_dir, args.eval, args.notes))


if __name__ == "__main__":
    main()
