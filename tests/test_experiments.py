"""Tests for the experiment registry (brief item 23)."""
from __future__ import annotations

import json
import os
import sys

AI_SERVICE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ai_service")
if AI_SERVICE_DIR not in sys.path:
    sys.path.insert(0, AI_SERVICE_DIR)

from diffusion.experiments import record_experiment  # noqa: E402


def test_record_experiment_captures_required_fields(tmp_path):
    ckpt_dir = tmp_path / "ckpt"
    ckpt_dir.mkdir()
    (ckpt_dir / "best.pt").write_bytes(b"fake-checkpoint")
    (ckpt_dir / "history.json").write_text(json.dumps([
        {"epoch": 0, "train_loss": 2.0, "val_loss": 1.5, "seconds": 3.0},
        {"epoch": 1, "train_loss": 1.0, "val_loss": 0.9, "seconds": 3.0},
    ]))
    eval_path = tmp_path / "eval.json"
    eval_path.write_text(json.dumps({"diffusion": {"mae": 0.1}}))

    cfg = os.path.join(AI_SERVICE_DIR, "configs", "diffusion_dev.yaml")
    out = record_experiment("unit", cfg, str(ckpt_dir), str(eval_path), output_dir=str(tmp_path / "exp"))
    entry = json.loads(open(out, encoding="utf-8").read())

    for key in ("experiment_id", "recorded_at_utc", "git_commit", "dataset", "model_config",
                "hyperparameters", "random_seed", "training", "test_metrics", "checkpoint"):
        assert key in entry
    assert entry["training"]["best_epoch"] == 1
    assert entry["training"]["epochs_run"] == 2
    assert entry["test_metrics"]["diffusion"]["mae"] == 0.1
    assert len(entry["checkpoint"]["sha256"]) == 64
    assert "NOT real patient data" in entry["dataset"]["kind"]


def test_record_experiment_tolerates_missing_artifacts(tmp_path):
    cfg = os.path.join(AI_SERVICE_DIR, "configs", "diffusion_dev.yaml")
    out = record_experiment("empty", cfg, str(tmp_path / "nope"), None, output_dir=str(tmp_path / "exp"))
    entry = json.loads(open(out, encoding="utf-8").read())
    assert entry["training"]["epochs_run"] == 0
    assert entry["checkpoint"]["sha256"] is None
