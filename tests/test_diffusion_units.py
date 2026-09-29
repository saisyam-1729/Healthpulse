"""Targeted unit tests for the diffusion component (brief item 22).

Complements tests/smoke_test_diffusion.py (end-to-end plumbing) with focused
checks on data handling, the diffusion process, conditioning, determinism,
and API validation. Fast, CPU-only, no trained checkpoint required.
"""
from __future__ import annotations

import os
import sys

import numpy as np
import pytest
import torch

AI_SERVICE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ai_service")
if AI_SERVICE_DIR not in sys.path:
    sys.path.insert(0, AI_SERVICE_DIR)

from diffusion.data.synthetic import generate_synthetic_dataset, CHANNEL_ORDER, VALID_RANGES  # noqa: E402
from diffusion.data.preprocessing import Normalizer, split_dataset, make_windows, WindowDataset  # noqa: E402
from diffusion.model.denoiser import CSDILiteDenoiser  # noqa: E402
from diffusion.model.scheduler import BetaScheduleConfig, GaussianDiffusion, make_beta_schedule  # noqa: E402

C = len(CHANNEL_ORDER)


@pytest.fixture(scope="module")
def dataset():
    return generate_synthetic_dataset(num_sequences=20, sequence_length=30, seed=3)


# ---------- data ----------

def test_timestamps_strictly_increasing(dataset):
    assert np.all(np.diff(dataset.timestamps, axis=1) > 0)


def test_missingness_matches_mask(dataset):
    assert np.array_equal(np.isnan(dataset.values), dataset.mask == 0.0)
    assert 0.0 < dataset.mask.mean() < 1.0


def test_synthetic_values_within_backend_ranges(dataset):
    for i, ch in enumerate(CHANNEL_ORDER):
        lo, hi = VALID_RANGES[ch]
        col = dataset.values[..., i]
        assert np.nanmin(col) >= lo and np.nanmax(col) <= hi


def test_normalizer_roundtrip_and_ignores_missing(dataset):
    n = Normalizer.fit(dataset.values, dataset.mask)
    assert np.all(np.isfinite(n.mean)) and np.all(n.std > 0)
    x = np.nan_to_num(dataset.values, nan=0.0)
    assert np.allclose(n.inverse_transform(n.transform(x)), x, atol=1e-3)
    observed = dataset.values[..., 0][dataset.mask[..., 0] == 1.0]
    assert n.mean[0] == pytest.approx(observed.mean(), rel=1e-4)


def test_normalizer_fit_uses_only_given_split(dataset):
    train, _, test = split_dataset(dataset, 0.6, 0.2, 0.2, seed=1)
    n = Normalizer.fit(train.values, train.mask)
    test_obs = test.values[..., 0][test.mask[..., 0] == 1.0]
    assert n.mean[0] != pytest.approx(test_obs.mean(), abs=1e-9)


def test_split_is_disjoint_complete_and_seeded(dataset):
    a = split_dataset(dataset, 0.6, 0.2, 0.2, seed=5)
    b = split_dataset(dataset, 0.6, 0.2, 0.2, seed=5)
    assert sum(s.values.shape[0] for s in a) == dataset.values.shape[0]
    for x, y in zip(a, b):
        assert np.array_equal(x.mask, y.mask)

    def rows(s):
        return {np.nan_to_num(v, nan=-1.0).tobytes() for v in s.values}

    train_rows, val_rows, test_rows = (rows(s) for s in a)
    assert not (train_rows & val_rows) and not (train_rows & test_rows) and not (val_rows & test_rows)


def test_window_shapes_and_count(dataset):
    ctx, pred = 8, 3
    v, m = make_windows(dataset, ctx, pred, stride=1)
    per_seq = dataset.values.shape[1] - (ctx + pred) + 1
    assert v.shape == (dataset.values.shape[0] * per_seq, ctx + pred, C)
    assert m.shape == v.shape


def test_window_too_short_raises(dataset):
    with pytest.raises(ValueError):
        make_windows(dataset, 40, 10)


def test_window_dataset_masks_are_consistent(dataset):
    n = Normalizer.fit(dataset.values, dataset.mask)
    ds = WindowDataset(dataset, n, context_length=8, prediction_length=3, artificial_mask_ratio=0.3)
    values, cond, target, gt = ds[0]
    assert values.shape == (11, C)
    assert torch.all(cond[8:] == 0)
    assert torch.all(cond * target == 0)
    assert torch.all(cond + target <= 1)
    assert torch.all(torch.isfinite(values))


def test_window_dataset_deterministic_flag(dataset):
    n = Normalizer.fit(dataset.values, dataset.mask)
    kw = dict(context_length=8, prediction_length=3, artificial_mask_ratio=0.3)
    d = WindowDataset(dataset, n, deterministic=True, seed=1, **kw)
    assert torch.equal(d[4][1], d[4][1])


# ---------- diffusion process ----------

def _diffusion(steps=20):
    return GaussianDiffusion(BetaScheduleConfig(steps, 1e-4, 0.5, "quad"), torch.device("cpu"))


def test_beta_schedules_valid():
    for sched in ("linear", "quad"):
        b = make_beta_schedule(BetaScheduleConfig(30, 1e-4, 0.5, sched))
        assert b.shape == (30,) and torch.all(b > 0) and torch.all(b < 1)
        assert torch.all(b[1:] >= b[:-1])


def test_forward_noising_shapes_and_limits():
    d = _diffusion()
    assert torch.all(d.alpha_bars[1:] < d.alpha_bars[:-1])
    x0 = torch.randn(4, 10, C)
    noise = torch.randn_like(x0)
    xt_early = d.q_sample(x0, torch.zeros(4, dtype=torch.long), noise)
    xt_late = d.q_sample(x0, torch.full((4,), d.T - 1), noise)
    assert xt_early.shape == x0.shape
    assert (xt_early - x0).abs().mean() < (xt_late - x0).abs().mean()


def _denoiser():
    torch.manual_seed(0)
    return CSDILiteDenoiser(num_channels=C, hidden_dim=8, time_embed_dim=8, feature_embed_dim=4,
                            num_layers=1, num_heads=2, dropout=0.0, diffusion_steps=20).eval()


def test_denoiser_output_shape():
    out = _denoiser()(torch.randn(2, 9, C), torch.randn(2, 9, C), torch.tensor([1, 5]))
    assert out.shape == (2, 9, C) and torch.all(torch.isfinite(out))


def test_conditioning_changes_output():
    net = _denoiser()
    noisy = torch.randn(1, 9, C)
    t = torch.tensor([3])
    a = net(noisy, torch.zeros(1, 9, C), t)
    b = net(noisy, torch.ones(1, 9, C), t)
    assert not torch.allclose(a, b)


def test_reverse_sampling_preserves_conditioned_and_is_seed_deterministic():
    d, net = _diffusion(), _denoiser()
    x0 = torch.randn(2, 9, C)
    cond = (torch.rand(2, 9, C) > 0.5).float()
    torch.manual_seed(11)
    s1 = d.sample(net, x0, cond, num_samples=2)
    torch.manual_seed(11)
    s2 = d.sample(net, x0, cond, num_samples=2)
    assert s1.shape == (2, 2, 9, C)
    assert torch.allclose(s1, s2)
    assert torch.allclose(s1[0] * cond, x0 * cond, atol=1e-6)


# ---------- API ----------

@pytest.fixture()
def client_no_model(tmp_path):
    from flask import Flask
    from diffusion.api.routes import diffusion_bp
    from diffusion.inference import service as svc

    original = svc._service_instance
    svc._service_instance = svc.DiffusionInferenceService(checkpoint_path=str(tmp_path / "missing.pt"))
    app = Flask(__name__)
    app.register_blueprint(diffusion_bp)
    yield app.test_client()
    svc._service_instance = original


@pytest.mark.parametrize("path,body", [
    ("/api/diffusion/impute", {}),
    ("/api/diffusion/impute", {"readings": []}),
    ("/api/diffusion/impute", {"readings": "nope"}),
    ("/api/diffusion/impute", {"readings": [{"heartRate": "abc"}]}),
    ("/api/diffusion/impute", {"readings": [1, 2]}),
    ("/api/diffusion/forecast", {"readings": [{"heartRate": 70}], "predictionLength": 0}),
    ("/api/diffusion/forecast", {"readings": [{"heartRate": 70}]}),
    ("/api/diffusion/generate", {"length": -1}),
    ("/api/diffusion/generate", {}),
    ("/api/diffusion/anomaly-score", {"readings": []}),
])
def test_invalid_requests_return_400(client_no_model, path, body):
    assert client_no_model.post(path, json=body).status_code == 400


def test_non_json_body_returns_400(client_no_model):
    assert client_no_model.post("/api/diffusion/impute", data="not json").status_code == 400


def test_valid_request_without_model_returns_503(client_no_model):
    r = client_no_model.post(
        "/api/diffusion/impute",
        json={"readings": [{"heartRate": 70, "spo2": 98, "temperature": 36.6}]},
    )
    assert r.status_code == 503
    assert "error" in r.get_json()


def test_health_reports_model_not_loaded(client_no_model):
    assert client_no_model.get("/api/diffusion/health").get_json() == {"modelLoaded": False}
