"""Fast end-to-end smoke test for the diffusion component (implementation
brief, item 33). Not a benchmark — verifies plumbing correctness only:

  1. generate tiny synthetic physiological data
  2. preprocess it (split, normalize, window, mask)
  3. construct a (tiny) model
  4. run a few training iterations
  5. save a checkpoint
  6. load the checkpoint
  7. run generate / forecast / impute
  8. verify tensor/array shapes
  9. verify outputs are finite
  10. verify the Flask API can serve one inference request

Run from the repo root:
    python -m pytest tests/smoke_test_diffusion.py -v
or directly:
    python tests/smoke_test_diffusion.py

Must finish in well under a minute on CPU — this is a plumbing check, not a
quality benchmark. No claim about model quality is made or should be
inferred from this test passing.
"""
from __future__ import annotations

import os
import sys
import tempfile

import numpy as np
import torch

AI_SERVICE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ai_service")
if AI_SERVICE_DIR not in sys.path:
    sys.path.insert(0, AI_SERVICE_DIR)

from diffusion.config import (  # noqa: E402
    DiffusionConfig, DataConfig, SplitConfig, ModelConfig, TrainingConfig, InferenceConfig, EvaluationConfig,
)
from diffusion.data.synthetic import generate_synthetic_dataset, CHANNEL_ORDER  # noqa: E402
from diffusion.data.preprocessing import Normalizer, split_dataset, WindowDataset  # noqa: E402
from diffusion.model.csdi import DiffusionModel  # noqa: E402


def _tiny_config(checkpoint_dir: str) -> DiffusionConfig:
    return DiffusionConfig(
        data=DataConfig(
            channels=list(CHANNEL_ORDER),
            context_length=6,
            prediction_length=2,
            synthetic={
                "num_sequences": 20,
                "sequence_length": 16,
                "sampling_interval_seconds": 5,
                "missing_prob": 0.1,
                "gap_prob": 0.05,
                "gap_length_range": [2, 4],
                "seed": 7,
            },
        ),
        split=SplitConfig(train_frac=0.6, val_frac=0.2, test_frac=0.2, seed=7),
        model=ModelConfig(
            name="csdi_lite", hidden_dim=8, time_embed_dim=8, feature_embed_dim=4,
            num_layers=1, num_heads=2, dropout=0.0, diffusion_steps=10,
            beta_start=0.0001, beta_end=0.5, schedule="quad",
            use_fourier_loss=True, fourier_loss_weight=0.05,
        ),
        training=TrainingConfig(
            seed=42, batch_size=4, epochs=2, learning_rate=1e-3, lr_scheduler="cosine",
            warmup_epochs=0, grad_clip_norm=1.0, early_stopping_patience=100,
            mixed_precision=False, checkpoint_dir=checkpoint_dir, resume_from=None,
            device="cpu", num_workers=0,
        ),
        inference=InferenceConfig(num_samples=3, sampling_steps=10, batch_size=4, timeout_seconds=10, device="cpu"),
        evaluation=EvaluationConfig(artificial_mask_ratio=0.3, prediction_interval=0.9),
    )


def test_smoke_diffusion_pipeline():
    with tempfile.TemporaryDirectory() as tmpdir:
        config = _tiny_config(tmpdir)
        device = torch.device("cpu")

        # 1. synthetic data
        raw = generate_synthetic_dataset(**config.data.synthetic)
        assert raw.values.shape == (
            config.data.synthetic["num_sequences"],
            config.data.synthetic["sequence_length"],
            len(CHANNEL_ORDER),
        )

        # 2. preprocess
        train_seq, val_seq, test_seq = split_dataset(
            raw, config.split.train_frac, config.split.val_frac, config.split.test_frac, config.split.seed
        )
        assert train_seq.values.shape[0] + val_seq.values.shape[0] + test_seq.values.shape[0] == raw.values.shape[0]

        normalizer = Normalizer.fit(train_seq.values, train_seq.mask)
        assert normalizer.mean.shape == (len(CHANNEL_ORDER),)
        assert np.all(np.isfinite(normalizer.mean)) and np.all(np.isfinite(normalizer.std))

        common = dict(
            context_length=config.data.context_length,
            prediction_length=config.data.prediction_length,
            artificial_mask_ratio=config.evaluation.artificial_mask_ratio,
        )
        train_ds = WindowDataset(train_seq, normalizer, deterministic=False, **common)
        assert len(train_ds) > 0
        values, cond_mask, target_mask, gt = train_ds[0]
        L = config.data.context_length + config.data.prediction_length
        assert values.shape == (L, len(CHANNEL_ORDER))
        assert cond_mask.shape == target_mask.shape == values.shape

        # 3. construct model
        model = DiffusionModel(config, normalizer, device)
        n_params = sum(p.numel() for p in model.denoiser.parameters())
        assert n_params > 0

        # 4. a few training iterations
        optimizer = torch.optim.Adam(model.denoiser.parameters(), lr=config.training.learning_rate)
        batch = torch.utils.data.DataLoader(train_ds, batch_size=config.training.batch_size, shuffle=True)
        losses = []
        for epoch in range(config.training.epochs):
            for v, cm, tm, g in batch:
                optimizer.zero_grad()
                loss = model.training_loss(v, cm, tm)
                assert torch.isfinite(loss), "training loss is not finite"
                loss.backward()
                optimizer.step()
                losses.append(loss.item())
        assert len(losses) > 0

        # 5. save checkpoint
        ckpt_path = os.path.join(tmpdir, "smoke.pt")
        model.save_checkpoint(ckpt_path, extra={"epoch": config.training.epochs - 1})
        assert os.path.exists(ckpt_path)

        # 6. load checkpoint
        loaded = DiffusionModel.load_checkpoint(ckpt_path, device)
        assert loaded.config.model.hidden_dim == config.model.hidden_dim

        # 7. generate / forecast / impute
        x0_known = torch.zeros(1, L, len(CHANNEL_ORDER))
        cond_mask_zero = torch.zeros(1, L, len(CHANNEL_ORDER))
        samples = loaded.sample(x0_known, cond_mask_zero, num_samples=3, sampling_steps=10)

        # 8. shapes
        assert samples.shape == (3, 1, L, len(CHANNEL_ORDER))

        # 9. finiteness
        assert torch.all(torch.isfinite(samples)), "generated samples contain non-finite values"

        # 10. API smoke check (in-process, no network)
        _api_smoke_check(ckpt_path)


def _api_smoke_check(ckpt_path: str) -> None:
    from diffusion.inference import service as service_module

    test_service = service_module.DiffusionInferenceService(checkpoint_path=ckpt_path)
    loaded_ok = test_service.load()
    assert loaded_ok, "smoke checkpoint failed to load into the inference service"

    original_instance = service_module._service_instance
    service_module._service_instance = test_service
    try:
        from flask import Flask
        from diffusion.api.routes import diffusion_bp

        app = Flask(__name__)
        app.register_blueprint(diffusion_bp)
        client = app.test_client()

        resp = client.post("/api/diffusion/generate", json={"length": 4, "numSamples": 2})
        assert resp.status_code == 200, resp.get_data(as_text=True)
        payload = resp.get_json()
        assert payload["synthetic"] is True
        assert len(payload["sequence"]) == 4
        for row in payload["sequence"]:
            for ch in CHANNEL_ORDER:
                assert np.isfinite(row[ch]), f"non-finite value returned for {ch}"
    finally:
        service_module._service_instance = original_instance


if __name__ == "__main__":
    test_smoke_diffusion_pipeline()
    print("smoke_test_diffusion: OK")
