# Open Questions for Project Owner

Raised after completing the repository audit and model-selection phase
(see [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md),
[DATA_PIPELINE.md](DATA_PIPELINE.md),
[MODEL_SELECTION.md](MODEL_SELECTION.md)). These are decisions that change
scope, effort, or timeline enough that they shouldn't be assumed
unilaterally before implementation starts.

## Scope-changing

1. **Is any real physiological/user data available for training or
   evaluation** (e.g., an export from a staging database), or should this
   phase proceed on synthetic data only? The repository itself contains no
   real dataset.
2. **Is stress-conditional modeling actually wanted?** Today "stress" in the
   app is entirely hand-coded heuristics, not a measurement — there is no
   ground truth to condition on. The BLE firmware computes real HRV
   (`rmssd`) on-device but it is never saved to the database. If stress
   modeling matters, the real first step is a backend change (persist
   `rmssd`), not an ML change — worth confirming who owns that and whether
   it's in scope now.
3. **Should pre-existing bugs found during the audit be fixed as part of
   this work?** Specifically: the `AI_SERVICE_URL` port mismatch (5001 vs
   the Flask service's actual 5002, likely making the existing AI
   integration silently no-op), a hardcoded admin login backdoor, a
   hardcoded JWT fallback secret, and a field-name typo that silently
   disables trend-based alerts. None are diffusion-related, but this
   project will be touching adjacent code.

## Effort/timeline-changing

4. **What inference latency is acceptable** for a forecast/imputation
   dashboard call? Diffusion sampling is inherently multi-step (slower than
   one forward pass) — this determines the diffusion-step budget and
   whether CPU-only inference is realistic.
5. **What are the actual deployment/hosting constraints** for the ML
   service? Adding PyTorch is a meaningful weight/cost increase over the
   current scikit-learn-only Flask service.
6. **How should the ~42-phase scope be broken into increments** with
   explicit sign-off points, rather than treated as one continuous
   deliverable?

## Smaller

7. Should the vestigial `supabase/` schema/edge-functions (fully unused,
   confirmed dead code) be deleted as cleanup, or left alone?
8. Is persisting `rmssd`/HRV to `HealthData` in scope for this project, or
   purely noted as future work?
