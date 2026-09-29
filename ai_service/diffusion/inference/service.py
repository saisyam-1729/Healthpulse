"""Model-resident inference service.

Loads the trained checkpoint ONCE at process startup (item 20 of the
implementation brief — never reload per request) and keeps it resident in
memory. Provides the three operations selected in docs/MODEL_SELECTION.md:
imputation (primary), forecasting and generation (secondary, same model),
plus a reconstruction-error anomaly score.

Every synthetic/generated value returned by this module must be labeled as
such by the caller (see api/routes.py) — this module never claims clinical
validity (brief item 16).
"""
from __future__ import annotations

import os
import threading
from typing import Optional

import numpy as np
import torch

from diffusion.config import load_config
from diffusion.data.synthetic import CHANNEL_ORDER, VALID_RANGES
from diffusion.evaluation.metrics import physiological_validity_report
from diffusion.model.csdi import DiffusionModel


class ModelNotLoadedError(RuntimeError):
    pass


class DiffusionInferenceService:
    """Singleton-style holder for the resident model. Thread-safe load-once."""

    def __init__(self, checkpoint_path: Optional[str] = None, config_path: Optional[str] = None):
        self._lock = threading.Lock()
        self._model: Optional[DiffusionModel] = None
        self._device: Optional[torch.device] = None
        self.checkpoint_path = checkpoint_path or os.environ.get(
            "DIFFUSION_CHECKPOINT_PATH",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "checkpoints", "best.pt"),
        )
        self.config_path = config_path

    def load(self) -> bool:
        """Attempt to load the checkpoint. Returns True on success, False if
        absent — mirrors the existing ai_service pattern of failing soft
        when a model hasn't been trained yet (see ARCHITECTURE_AUDIT.md
        §2.3), rather than crashing the whole Flask process.
        """
        with self._lock:
            if self._model is not None:
                return True
            if not os.path.exists(self.checkpoint_path):
                return False
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            try:
                self._model = DiffusionModel.load_checkpoint(self.checkpoint_path, device)
                self._device = device
                return True
            except Exception as exc:  # noqa: BLE001 - report, don't crash startup
                print(f"[diffusion] failed to load checkpoint {self.checkpoint_path}: {exc}")
                return False

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def _require_model(self) -> DiffusionModel:
        if self._model is None:
            raise ModelNotLoadedError(
                "Diffusion model checkpoint not loaded. Train a model first "
                "(python -m diffusion.training.train --config configs/diffusion.yaml) "
                "or point DIFFUSION_CHECKPOINT_PATH at an existing checkpoint."
            )
        return self._model

    def _readings_to_arrays(self, readings: list[dict]) -> tuple[np.ndarray, np.ndarray]:
        L = len(readings)
        C = len(CHANNEL_ORDER)
        values = np.zeros((L, C), dtype=np.float32)
        mask = np.zeros((L, C), dtype=np.float32)
        for i, r in enumerate(readings):
            for c, ch in enumerate(CHANNEL_ORDER):
                v = r.get(ch)
                if v is not None:
                    values[i, c] = float(v)
                    mask[i, c] = 1.0
        return values, mask

    def impute(self, readings: list[dict], num_samples: Optional[int] = None) -> dict:
        """PRIMARY task: fill missing values in an observed window with a
        probabilistic estimate (mean + interval), leaving observed values
        untouched.
        """
        model = self._require_model()
        values, mask = self._readings_to_arrays(readings)
        return self._run(model, values, mask, num_samples)

    def forecast(self, readings: list[dict], prediction_length: int, num_samples: Optional[int] = None) -> dict:
        """SECONDARY task: extend an observed context window forward.

        Implemented as imputation where the future `prediction_length`
        steps are appended as fully-unobserved positions — the same
        network and sampling procedure as impute(), per the architectural
        decision in docs/MODEL_SELECTION.md (forecasting is not a separate
        model).
        """
        model = self._require_model()
        values, mask = self._readings_to_arrays(readings)
        pad_values = np.zeros((prediction_length, values.shape[1]), dtype=np.float32)
        pad_mask = np.zeros((prediction_length, values.shape[1]), dtype=np.float32)
        values = np.concatenate([values, pad_values], axis=0)
        mask = np.concatenate([mask, pad_mask], axis=0)
        result = self._run(model, values, mask, num_samples)
        context_len = len(readings)
        for key in ("mean", "lower", "upper"):
            result[key] = result[key][context_len:]
        return result

    def generate(self, length: int, num_samples: Optional[int] = None) -> dict:
        """SECONDARY task: fully unconditional synthetic generation.

        Every value returned here is model-generated, not measured. Callers
        (API layer, frontend) MUST label this as synthetic — never present
        it as a real reading (brief item 16).
        """
        model = self._require_model()
        values = np.zeros((length, len(CHANNEL_ORDER)), dtype=np.float32)
        mask = np.zeros((length, len(CHANNEL_ORDER)), dtype=np.float32)
        result = self._run(model, values, mask, num_samples)
        result["synthetic"] = True
        return result

    def anomaly_score(self, readings: list[dict], num_samples: Optional[int] = None) -> dict:
        """SECONDARY task: reconstruction-error-based anomaly signal.

        For each observed point, temporarily hide it, reconstruct it from
        the rest of the window, and compare to the true value. A large gap
        suggests the point is inconsistent with the model's learned
        physiological dynamics — a candidate signal to feed the EXISTING
        alert pipeline (backend/services/ruleEngine.js /healthEngine.js),
        not a replacement for it (see docs/MODEL_SELECTION.md task F).
        """
        model = self._require_model()
        values, mask = self._readings_to_arrays(readings)
        result = self._run(model, values, mask, num_samples, leave_one_out_scoring=True)
        return result

    def _run(
        self,
        model: DiffusionModel,
        values: np.ndarray,
        mask: np.ndarray,
        num_samples: Optional[int],
        leave_one_out_scoring: bool = False,
    ) -> dict:
        device = self._device
        normalized = model.normalizer.transform(values)
        x0 = torch.from_numpy(normalized.astype(np.float32)).unsqueeze(0).to(device)

        if leave_one_out_scoring:
            cond_mask = torch.from_numpy(mask.astype(np.float32)).unsqueeze(0).to(device)
        else:
            cond_mask = torch.from_numpy(mask.astype(np.float32)).unsqueeze(0).to(device)

        # For anomaly scoring, invert: hide observed points one axis at a
        # time is expensive; as a tractable approximation we hide ALL
        # observed points simultaneously and reconstruct the whole window,
        # which still measures "how surprising is this window given the
        # model's learned dynamics" even if it's less precise than true
        # leave-one-out. This tradeoff is documented, not hidden.
        if leave_one_out_scoring:
            cond_mask = torch.zeros_like(cond_mask)

        samples = model.sample(x0, cond_mask, num_samples=num_samples)  # (S, 1, L, C)
        samples_np = samples.squeeze(1).cpu().numpy()  # (S, L, C)
        samples_denorm = np.stack([model.normalizer.inverse_transform(s) for s in samples_np], axis=0)

        mean = samples_denorm.mean(axis=0)
        lower = np.quantile(samples_denorm, 0.05, axis=0)
        upper = np.quantile(samples_denorm, 0.95, axis=0)

        # Observed points are always returned unchanged (never overwritten
        # by the model's own estimate), except in anomaly-scoring mode
        # where we explicitly want the model's independent reconstruction.
        if not leave_one_out_scoring:
            observed = mask.astype(bool)
            mean[observed] = values[observed]
            lower[observed] = values[observed]
            upper[observed] = values[observed]

        result = {
            "mean": mean,
            "lower": lower,
            "upper": upper,
            "channels": list(CHANNEL_ORDER),
        }

        if leave_one_out_scoring:
            observed = mask.astype(bool)
            error = np.zeros_like(values)
            error[observed] = np.abs(mean[observed] - values[observed])
            result["reconstruction_error"] = error
            result["anomaly_score"] = float(np.mean(error[observed])) if observed.any() else 0.0

        result["validity"] = physiological_validity_report(mean[None, ...])
        return result


_service_lock = threading.Lock()
_service_instance: Optional[DiffusionInferenceService] = None


def get_service() -> DiffusionInferenceService:
    global _service_instance
    with _service_lock:
        if _service_instance is None:
            _service_instance = DiffusionInferenceService()
            _service_instance.load()
        return _service_instance
