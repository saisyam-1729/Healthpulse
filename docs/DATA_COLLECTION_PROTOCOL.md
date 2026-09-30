# HealthPulse Device Data Collection Protocol

**Status:** draft for the project owner's review. **Section 2 (success
criteria) must be confirmed and signed off before the first session**, and not
changed after data collection starts.

This is an engineering data-collection plan for improving and testing
HealthPulse's own software. It is not a clinical study, and nothing recorded
here is used for any participant's health decisions. Check with your
university or company whether an ethics review is required before starting;
even if none is, written consent (see `CONSENT_FORM.md`) is required.

---

## 1. Why we are collecting this

The real-data evaluation (IMPLEMENTATION_REPORT.md section 10b) used a public
dataset from a different, wrist-worn device with no real dropouts. On it,
linear interpolation beat the diffusion model. What we still do not know:

1. **Is the HealthPulse sensor itself accurate enough to model?** (device vs.
   a reference pulse oximeter)
2. **What do real HealthPulse gaps look like?** How often the finger comes
   off, how long gaps last, and how often data is lost in transmission.
3. **On those real gaps, does the model beat interpolation, or at least give
   a trustworthy uncertainty band?**

Question 1 must be answered first: modelling a sensor that is wrong is
pointless.

## 2. Success criteria (to be confirmed before collecting anything)

Proposed values. Replace or confirm them, then fill in the sign-off line.
All criteria are evaluated with leave-one-participant-out: the model is
trained without a participant and scored on that participant.

| # | Question | Criterion | If not met |
|---|---|---|---|
| S1 | Sensor accuracy | At seated rest, device vs. reference: heart-rate mean absolute error at most **5 bpm**, SpO2 at most **2 %** | Fix sensor, placement or firmware before any modelling |
| S2 | Enough data | At least **5 participants** with at least **20 minutes** of usable recording each | Collect more before analysing |
| M1 | Point estimates | Diffusion heart-rate error on **real** finger-off gaps of 15-60 s is **lower than** linear interpolation's | Use interpolation for the displayed estimate |
| M2 | Uncertainty | The model's 90 % band contains **85-95 %** of true values on those gaps | Do not show the band |
| D | Decision | Panel returns only if M1 or M2 is met | Keep the panel hidden; consider retiring the model from the dashboard |

Confirmed by: ______________________  Date: ____________

## 3. Equipment

- HealthPulse device (`esp32_health_monitor`) with **firmware 2.3 or later
  and `COLLECTION_MODE` set to 1**, connected to the backend over WiFi.
  WiFi and keys go in `esp32_health_monitor/secrets.h` (copy
  `secrets.example.h`; never commit it).
- A **reference pulse oximeter**: a clip-on fingertip oximeter, ideally one
  with a medical certification (e.g. CE or FDA-cleared), worn on a finger of
  the **other** hand. If it cannot export data, film its display with a phone
  for the whole session (the video timestamp is the reference clock).
- A phone or laptop showing the current time (for the session sheet).
- A room thermometer.
- Printed session sheets (section 6) and consent forms.

## 4. Participants

- 5-10 adults (18 or over) who can sit and walk slowly without difficulty.
- Not included: anyone who feels unwell on the day, or for whom light walking
  is not comfortable. Participants may stop at any time without giving a
  reason.
- Each participant gets a code (P01, P02, ...). Names appear only on the
  consent form, which is stored separately from the data.

## 5. Session plan (about 35 minutes)

Record the **clock time at the start of every segment** on the session sheet.
The reference oximeter stays on the other hand for the whole session.

| Segment | Duration | What the participant does | Why |
|---|---|---|---|
| Setup | 3 min | Sit, attach both sensors, check readings appear. Not analysed | Warm-up; the device needs 10 beats before the first heart rate |
| A. Rest | 5 min | Sit still, breathe normally | Clean baseline; sensor accuracy (S1) |
| B. Finger-off drills | 5 min | With the finger on in between: lift the finger off for 15 s, replace; wait 60 s; off for 30 s; wait 60 s; off for 60 s; replace | Known, timed, real dropouts of different lengths (M1, M2) |
| C. Poor contact | 3 min | Rest the finger lightly or slightly off-centre on the sensor | Realistic noisy readings |
| D. Light activity | 5 min | Slow walking in place, or stand up and sit down every 30 s if walking with the device is awkward | Raises heart rate; motion artefacts |
| E. Mental task | 3 min | Seated, count backwards from 500 in steps of 7 | Varies heart rate without movement |
| F. Network drill | 2 min | Seated, finger on; the researcher switches the WiFi hotspot off for 60 s, then on again | Known transmission gaps, to separate network loss from sensor loss |
| G. Rest | 5 min | Sit still | Recovery; second baseline |

## 6. What is recorded

**By the device** (per reading, every 5 s in collection mode, including when
no finger is present):

| Field | Meaning |
|---|---|
| `deviceId` | Which device |
| `seq` | Counts every scheduled send, including ones that fail. A jump in `seq` means readings were **lost in transmission** |
| `deviceTime` | The device's own clock (synced over the internet), so timing does not depend on when the server received the reading |
| `fingerPresent` | Whether the sensor detected a finger. `false` with no values means a **sensor gap**, not lost data |
| `heartRate`, `spo2`, `temperature` | The readings; `null` when not valid |
| `firmwareVersion` | Which firmware produced the reading |

**By the researcher**, on the session sheet: participant code, date, device
ID, which hand and finger for each sensor, room temperature, the clock time at
the start of each segment, the exact times the finger was lifted and replaced
in segment B, the WiFi off/on times in segment F, and anything unusual.

**Reference oximeter:** its readings for the whole session (exported file, or
the phone video of its display).

## 7. Data handling and privacy

- Data is labelled only with the participant code. The link between code and
  name exists only on the consent forms, kept separately (not on the same
  computer folder).
- Exports go to `ai_service/data/raw/healthpulse/`, which is **gitignored**.
  Participant data must never be committed to git, uploaded to a public
  location, or pasted into third-party tools.
- A participant can ask for their data to be deleted at any time; delete every
  copy.
- Decide and write down in advance how long the data is kept.
- Records stored in the database **before** firmware 2.3 / backend change
  MOD-032 contain placeholder values and are excluded from analysis.

## 8. Safety

- The HealthPulse device is not a medical device. Its readings are not
  shown to participants as health information and are not used for any
  decision about them.
- Stop the session if the participant feels unwell, dizzy or uncomfortable.
- If the **reference** oximeter shows SpO2 below 90 % or a resting heart rate
  above 150 bpm, stop, and suggest the participant seeks medical advice. Do
  not interpret the HealthPulse device's own readings.
- The device's buzzer may sound on its own alert thresholds; tell participants
  in advance that this is expected and not a diagnosis.

## 9. Analysis plan (fixed in advance)

1. **Sensor accuracy (S1):** align device and reference readings by clock
   time; compute heart-rate and SpO2 mean absolute error in segments A and G.
2. **Gap statistics:** from `fingerPresent` and `seq`, count sensor gaps and
   transmission gaps and their lengths, per segment.
3. **Model evaluation (M1, M2):** leave-one-participant-out; the gaps scored
   are the **real** finger-off gaps in segment B, using the reference
   oximeter's heart rate as the true value during the gap. Same metrics and
   baselines as the Non-EEG evaluation.
4. Report every criterion as met or not met, with the numbers, whichever way
   they come out.

## 10. Known device limitations to keep in mind

- The first heart rate needs 10 detected beats after the finger is placed.
  Firmware before 2.3 then **froze** the heart rate at that first average
  until the finger was lifted; 2.3 updates it as a rolling average of the last
  10 beats. Do not use pre-2.3 recordings.
- The SpO2 calibration curve in the firmware has not been validated against a
  reference; S1 checks this.
- Temperature is fingertip **skin** temperature (often 25-34 degC), not body
  temperature.
- The device must be on the same network as the backend (it posts to a fixed
  address set in the firmware).
