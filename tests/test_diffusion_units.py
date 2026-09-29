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


# ---------- single-pass forecast + context, sampling options ----------

@pytest.mark.parametrize("extra", [{"numSamples": 0}, {"numSamples": 101}, {"numSamples": "3"}, {"samplingSteps": 0}, {"samplingSteps": True}, {"samplingSteps": 5000}])
def test_invalid_sampling_options_return_400(client_no_model, extra):
    body = {"readings": [{"heartRate": 70, "spo2": 98, "temperature": 36.6}], "predictionLength": 2, **extra}
    assert client_no_model.post("/api/diffusion/forecast", json=body).status_code == 400
    assert client_no_model.post("/api/diffusion/impute", json={"readings": body["readings"], **extra}).status_code == 400


@pytest.fixture(scope="module")
def tiny_client(tmp_path_factory):
    from flask import Flask
    from smoke_test_diffusion import _tiny_config
    from diffusion.api.routes import diffusion_bp
    from diffusion.inference import service as svc
    from diffusion.model.csdi import DiffusionModel

    directory = tmp_path_factory.mktemp("tiny")
    data = generate_synthetic_dataset(num_sequences=6, sequence_length=16, seed=1)
    normalizer = Normalizer.fit(data.values, data.mask)
    model = DiffusionModel(_tiny_config(str(directory)), normalizer, torch.device("cpu"))
    ckpt = str(directory / "tiny.pt")
    model.save_checkpoint(ckpt)

    original = svc._service_instance
    service = svc.DiffusionInferenceService(checkpoint_path=ckpt)
    assert service.load()
    svc._service_instance = service
    app = Flask(__name__)
    app.register_blueprint(diffusion_bp)
    yield app.test_client()
    svc._service_instance = original


def _window(n, gap=()):
    return [
        {"heartRate": None if i in gap else 70.0 + i, "spo2": None if i in gap else 98.0, "temperature": None if i in gap else 36.6}
        for i in range(n)
    ]


def test_forecast_can_return_context_in_one_pass(tiny_client):
    readings = _window(8, gap=(3, 4))
    body = {"readings": readings, "predictionLength": 3, "numSamples": 2, "samplingSteps": 5, "includeContext": True}
    res = tiny_client.post("/api/diffusion/forecast", json=body)
    assert res.status_code == 200, res.get_data(as_text=True)
    data = res.get_json()
    assert len(data["forecast"]) == len(data["lower"]) == len(data["upper"]) == 3
    ctx = data["context"]
    assert len(ctx["imputed"]) == len(ctx["lower"]) == len(ctx["upper"]) == 8
    assert ctx["imputed"][0]["heartRate"] == pytest.approx(70.0, abs=1e-3)   # observed values echoed back unchanged
    assert ctx["imputed"][3]["heartRate"] is not None                          # gap was filled
    assert np.isfinite(ctx["imputed"][3]["heartRate"])


def test_forecast_omits_context_unless_requested(tiny_client):
    body = {"readings": _window(6), "predictionLength": 2, "numSamples": 2, "samplingSteps": 5}
    assert "context" not in tiny_client.post("/api/diffusion/forecast", json=body).get_json()


# ---------- respaced (strided) sampling ----------

def _reference_ddpm_sample(d, net, x0, cond, seed):
    """Textbook one-step-at-a-time DDPM ancestral sampler, written independently of scheduler.sample."""
    torch.manual_seed(seed)
    cond_value = x0 * cond
    cur = torch.randn_like(x0)
    for t in range(d.T - 1, -1, -1):
        eps = net(cur * (1 - cond), cond_value, torch.full((x0.shape[0],), t, dtype=torch.long))
        mean = (cur - d.betas[t] / (1 - d.alpha_bars[t]).sqrt() * eps) / d.alphas[t].sqrt()
        cur = mean + d.betas[t].sqrt() * torch.randn_like(cur) if t > 0 else mean
        cur = cur * (1 - cond) + cond_value
    return cur


def test_full_step_sampling_matches_textbook_ddpm():
    d, net = _diffusion(), _denoiser()
    x0 = torch.randn(2, 7, C)
    cond = (torch.rand(2, 7, C) > 0.5).float()
    torch.manual_seed(5)
    ours = d.sample(net, x0, cond, num_samples=1, sampling_steps=d.T)[0]
    assert torch.allclose(ours, _reference_ddpm_sample(d, net, x0, cond, seed=5), atol=1e-5)


@pytest.mark.parametrize("steps", [2, 5, 10])
def test_strided_sampling_is_finite_and_keeps_observed_values(steps):
    d, net = _diffusion(20), _denoiser()
    x0 = torch.randn(2, 7, C)
    cond = (torch.rand(2, 7, C) > 0.5).float()
    out = d.sample(net, x0, cond, num_samples=2, sampling_steps=steps)
    assert out.shape == (2, 2, 7, C) and torch.all(torch.isfinite(out))
    assert torch.allclose(out[0] * cond, x0 * cond, atol=1e-6)


def test_last_reverse_step_adds_no_noise(monkeypatch):
    d, net = _diffusion(20), _denoiser()
    calls = {"n": 0}
    real = torch.randn_like

    def counting(*args, **kwargs):
        calls["n"] += 1
        return real(*args, **kwargs)

    monkeypatch.setattr(torch, "randn_like", counting)
    x0, cond = torch.zeros(1, 7, C), torch.zeros(1, 7, C)
    for steps in (20, 5):
        calls["n"] = 0
        d.sample(net, x0, cond, num_samples=1, sampling_steps=steps)
        assert calls["n"] == steps - 1  # noise is injected between steps, never after the final one


# ---------- real-data loader and burst masking ----------

def _write_wfdb(path, name, fs, signals):
    """signals: list of (label, unit, gain, baseline, physical_array)."""
    n = len(signals[0][4])
    lines = [f"{name} {len(signals)} {fs} {n}"]
    cols = []
    for label, unit, gain, baseline, phys in signals:
        lines.append(f"{name}.dat 16 {gain}({baseline})/{unit} 16 0 0 0 0 {label}")
        cols.append(np.round(np.asarray(phys) * gain + baseline).astype("<i2"))
    (path / f"{name}.hea").write_text("\n".join(lines) + "\n# age: 1\n")
    np.stack(cols, axis=1).astype("<i2").tofile(path / f"{name}.dat")


def test_noneeg_loader_parses_and_resamples(tmp_path):
    from diffusion.data.noneeg import read_wfdb, load_noneeg

    seconds = 20
    hr = np.linspace(60, 79, seconds)
    spo2 = np.full(seconds, 97.0)
    temp8 = np.repeat(np.linspace(30, 31.9, seconds), 8)
    for s in (1, 2):
        _write_wfdb(tmp_path, f"Subject{s}_SpO2HR", 1, [("SpO2", "%", 100.0, -9000, spo2), ("hr", "bpm", 100.0, -7000, hr)])
        _write_wfdb(tmp_path, f"Subject{s}_AccTempEDA", 8, [("temp", "degC", 100.0, -3000, temp8)])

    fs, sig = read_wfdb(str(tmp_path / "Subject1_SpO2HR"))
    assert fs == 1.0 and np.allclose(sig["hr"], hr, atol=0.01)

    d = load_noneeg(str(tmp_path), step_seconds=5, subjects=[1, 2])
    assert d.values.shape == (2, 4, 3)                        # 20 s -> 4 five-second steps
    assert np.allclose(d.values[0, :, 0], [hr[i:i + 5].mean() for i in range(0, 20, 5)], atol=0.01)
    assert np.allclose(d.values[0, :, 1], 97.0, atol=0.01)
    assert np.allclose(d.values[0, 0, 2], np.linspace(30, 31.9, seconds)[:5].mean(), atol=0.01)
    assert d.mask.min() == 1.0 and np.all(np.diff(d.timestamps[0]) == 5)


def test_burst_mask_hides_one_contiguous_block_on_all_channels(dataset):
    n = Normalizer.fit(dataset.values, dataset.mask)
    full = generate_synthetic_dataset(num_sequences=5, sequence_length=30, missing_prob=0.0, gap_prob=0.0, seed=4)
    ds = WindowDataset(full, n, context_length=12, prediction_length=3, artificial_mask_ratio=0.2,
                       deterministic=True, seed=3, mask_strategy="burst", burst_length_range=(3, 5))
    for i in range(10):
        _, cond, target, _ = ds[i]
        hidden = (target[:12] == 1).numpy()
        rows = np.where(hidden.all(axis=1))[0]
        assert np.array_equal(hidden.any(axis=1), hidden.all(axis=1))       # all channels together
        assert 3 <= len(rows) <= 5 and np.all(np.diff(rows) == 1)            # one contiguous block
        assert rows[0] > 0 and rows[-1] < 11                                  # observed on both sides
        assert torch.all(cond[12:] == 0)


def test_unknown_mask_strategy_rejected(dataset):
    n = Normalizer.fit(dataset.values, dataset.mask)
    with pytest.raises(ValueError):
        WindowDataset(dataset, n, context_length=8, prediction_length=2, artificial_mask_ratio=0.2, mask_strategy="nope")
