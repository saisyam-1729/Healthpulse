# HealthPulse diffusion project: status update

**Date:** 1 October 2026 · **Code:** `github.com/saisyam-1729/Healthpulse` (branch `main`) · Details in `docs/`

## Summary

- A diffusion model for filling gaps in, and forecasting, heart rate, SpO2 and temperature is built, tested and connected end to end (device → backend → model → dashboard).
- **On real data it is not yet more accurate than simple linear interpolation.** Its one demonstrated advantage is well-calibrated uncertainty ranges. The dashboard panel that shows it is therefore hidden from regular users for now.
- While doing this, several serious existing problems were found and fixed. They include an admin backdoor, a way for anyone to register as an admin, public access to uploaded medical reports, and data loss at ingestion.
- The next step is recording data from HealthPulse's own device. The protocol is ready and needs your sign-off.

## What was built

- **Model:** a small conditional diffusion model (CSDI-style, about 280k parameters) that fills missing readings and forecasts the next 30 seconds, with uncertainty ranges. Chosen after reviewing CSDI, TimeGrad, Diffusion-TS and others (`MODEL_SELECTION.md`).
- **Pipeline:** synthetic data generator, leak-free preprocessing, training, evaluation against four non-diffusion baselines, experiment log.
- **Integration:** the model is served by the existing Python service, reached through an authenticated backend route, and shown in a clearly labelled dashboard panel. A request takes about 1.5 s on CPU.
- **Tests:** 46 Python, 56 backend and 17 frontend tests.

## Results

| Test | Diffusion | Best simple method |
|---|---|---|
| Synthetic data, gap filling (normalised error) | 0.268 | 0.269 (attention imputer), a tie |
| Real data, heart-rate gap filling (bpm error) | 2.78 | **1.49** (linear interpolation) |
| Real data, 15-40 s gaps | 3.55 | **2.69** |
| Real data, 60-100 s gaps | 5.62 | **3.81** |
| Real data, 30 s forecast | 4.90 | **4.05** (last value) |
| Uncertainty: share of true values inside the 90% range | 83-90% (68% on 60-100 s gaps) | not available |

The real data is 4 held-out subjects from a public dataset (PhysioNet Non-EEG, 20 healthy adults, wrist sensor). It is a different device from ours and has no real dropouts. The model trained only on synthetic data was unusable on it: about 5 °C off on temperature, with ranges covering about 30% of true values. Pretraining on synthetic data, then fine-tuning on real data, clearly helped. Full numbers are in `IMPLEMENTATION_REPORT.md` section 10b.

## Problems found and fixed

- **Security:**
  - a hardcoded admin login;
  - signup accepted `role: "admin"`;
  - a public fallback token-signing secret, which allowed forged logins;
  - uploaded medical reports and the device list readable without logging in;
  - login tokens in URLs and logs;
  - WiFi and device credentials in the firmware source.
- **Data:**
  - one out-of-range temperature discarded the whole reading;
  - missing values were stored as 0 bpm, 0% and 36.5 °C;
  - the device's heart rate froze after the first 10 beats;
  - trend alerts never ran because of a field-name typo;
  - the AI-service address pointed at the wrong port.

## Decisions needed from you

1. **Deployment actions (urgent):**
   - set `JWT_SECRET`;
   - promote an admin account;
   - run `adminAccounts.js lock admin` to disable any leftover backdoor account;
   - **change the WiFi password and device key**, which are public in the repository history.
2. **Device data collection:** approve `DATA_COLLECTION_PROTOCOL.md` and its success criteria, and say whether an ethics review is required.
3. **Temperature rules:** the device measures skin temperature (often 25–34 °C), but the fever alert and the stress score assume core body temperature. Most users therefore get an inflated stress score. This needs clinical input.
4. **The forecast panel:** keep it hidden, or bring it back showing the interpolated value together with the model's uncertainty range.
5. **Old records:** readings stored before the fixes contain placeholder values and should be excluded from any analysis.
6. **Scope:** stress modelling needs heart-rate variability to be stored first. Hosting limits for the Python/PyTorch service are also still open.

## Next steps

1. Flash firmware 2.3 and check it on the device.
2. Record 5–10 people with a reference oximeter, following the protocol.
3. Re-run the same evaluation on that data against the agreed criteria.
4. Decide whether the model stays in the product.
