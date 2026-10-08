# Interaction map (approved)

## Global state (one store)

```
focalId: number | null          // fixture id the edits started from (default 276)
features: CustomerFeatures       // current 19 raw values (may be edited)
edited: boolean                  // features !== fixture row of focalId
totalChargesLinked: boolean      // default true
threshold: 0.10                  // from calibrators.json; Evaluation rail may preview others (sample only)
model: 'loading' | 'warming' | 'ready' | 'error'
focalP: number | null; folds: number[5] | null   // LIVE
grid: Float32Array | null; gridMeta {cols, rows, ms, coarse}
beatIndex, beatProgress
```

## Elements

| Element | Input | Output / effect | States |
|---|---|---|---|
| **Focal crosshair** (on the terrain) | pointer drag; touch drag (with a 6px slop so page scroll still works); keyboard when focused: ←/→ tenure ±1 mo (Shift ±12), ↑/↓ charge ±$1 (Shift ±$10) | Sets `tenure` and `MonthlyCharges`, with TotalCharges re-derived if linked. Single-row LIVE inference per rAF (coalesced). Coarse grid at most every 100ms during the drag, full grid 150ms after release. | idle · hover (r+1, cursor `grab`) · dragging (`grabbing`, tag follows) · crossing (tag color flip plus a rail pulse) |
| **Customer point** | hover/focus; click/Enter | Tooltip with mono facts and the real p. Click: `focalId = id`, `features = fixture row`, `edited = false`, re-slice the terrain, pan the camera. | default · hover · selected · defocused |
| **Instrument rail** (collapsed 20px, expanded 320px) | hover/focus-within expands; pin toggle; `L` key toggles | Holds all 19 controls in 4 groups: **Account** (tenure, MonthlyCharges, TotalCharges plus a link toggle, Contract, PaperlessBilling, PaymentMethod), **Services** (PhoneService, MultipleLines, InternetService, OnlineSecurity, OnlineBackup, DeviceProtection, TechSupport, StreamingTV, StreamingMovies), **Demographics** (gender, SeniorCitizen, Partner, Dependents). | collapsed (shows 19 state ticks: a tick is ivory if it differs from the fixture) · expanded · pinned (beat 4 default) |
| **Segmented control** (≤ 4 options) | click, ←/→ within the radiogroup | Sets one categorical. Full grid immediately. | value · changed-from-fixture (mint 2px left bar) · disabled-by-rule (gray-dim, tooltip explains why) |
| **Numeric scrubber** (tenure, MonthlyCharges, TotalCharges) | drag the number horizontally; type; ↑/↓ | Same as the crosshair for tenure and charge. Valid ranges: tenure 0–72, charge 18.25–118.75 (full-dataset min/max measured from `data/raw/Telco-Customer-Churn.csv`; TotalCharges there spans 18.8–8684.8), TotalCharges ≥ 0. | Out-of-range input is clamped, with a gray note "outside training range". |
| **Reset** | click; `R` | `features` = fixture row of `focalId`, `edited = false` | – |
| **Inference ledger** | hover: expands to show the 5 fold values | Read-only: `rows · 5 folds · {ms} · wasm`, plus five ticks on a 0–1 strip and their mean. | loading % · warming · ready · inferring (hairline progress) · error |
| **Mini threshold rail** | hover a tick → tooltip; click → select that customer | 400 ticks at logit(p), the edited customer's live tick, and the coral 0.10 rule | – |
| **Contribution ledger row** (beat 5) | hover/focus | Highlights the related rail control or axis. Sensitivity rows: click applies that switch. | SHAP (solid) · sensitivity (hatched) |
| **Feature list row** (beat 2) | click | Sets the feature lens | active |
| **"Call it" buttons** (beat 4) | click; `1` / `2` | Reveals the actual and predicted outcome | once per session |
| **Evaluation threshold rail** | drag; ←/→ ±0.01 on a logit step | Re-sorts sample dots into cells, ticks the sample counts. Does **not** change the Lab's threshold. | marks at 0.10 / 0.50 |
| **Skip intro** | click; `Esc` | Jump to the hero end-state | – |

## Feature constraints

These enforce valid Telco combinations. They mirror the training data, so invalid rows never reach the model.

1. `InternetService = "No"`:
   - Force OnlineSecurity, OnlineBackup, DeviceProtection, TechSupport, StreamingTV and StreamingMovies to `"No internet service"`. Their controls are disabled with the note "requires internet".
   - Switching InternetService back to DSL or Fiber restores each one's previous value, or `"No"`.
2. `PhoneService = "No"`: force `MultipleLines = "No phone service"`, with the same restore behavior.
3. The reverse rule: `"No internet service"` and `"No phone service"` are **not selectable** directly. They only appear through rules 1–2.
4. **TotalCharges linked (default):** `TotalCharges = round(tenure × MonthlyCharges, 2)`. If the visitor unlinks it, TotalCharges becomes a free scrubber with the note "unlinked: real customers' totals ≈ tenure × monthly". It re-links when the visitor re-checks the box or resets.
5. SeniorCitizen values are the strings `"0"` and `"1"`. Display them as "No" and "Yes", but send `"0"` and `"1"`. Category strings must exactly match `metadata.json` `category_values`.

## SHAP labeling rule (one-hot to human)

A SHAP feature looks like `cat__{Feature}_{value}` or `num__{Feature}`. For the focal customer's actual value `v*`:

| Case | Label pattern | Example (#276) |
|---|---|---|
| `num__X` | "{X} = {value}" | `num__tenure +0.15` → "Tenure = 10 months · raises risk +0.15" |
| `cat__X_v` with `v == v*` | "{X} is {v}" | `cat__Contract_Month-to-month +0.72` → "Contract is Month-to-month · raises risk" |
| `cat__X_v` with `v != v*` | "{X} is not {v} (is {v*})" | `cat__InternetService_Fiber optic −0.31` → "Internet is not Fiber optic (is DSL) · lowers risk" |

The raw encoded name is always shown in `micro` mono under the human label.

## Probability display rules

- 3 decimals.
- Values ≤ 0.0005 display as `<0.001`, and values ≥ 0.9995 display as `>0.999`. Isotonic calibration produces exact 0 and 1.
- The class verdict is computed with `p >= threshold` using the **unrounded** p.

## Model lifecycle states (visible)

| State | Lab behavior |
|---|---|
| `loading` | Controls are usable. The tag shows the **fixture** p (FIXTURE style, no live dot) for unedited rows. Edits queue, and the tag shows `model loading {n}%`. |
| `warming` (sessions created, first run pending) | Same as above. |
| `ready` | All edits are LIVE. A queued edit runs immediately. |
| `error` (wasm blocked, OOM) | A coral line: "The in-browser model couldn't start ({reason}). Precomputed predictions for the 400 real customers still work; editing is disabled." The site remains fully navigable. |

## Pointer, touch and keyboard

- **All interactions work by keyboard.**
- Tab order: Skip → main nav → focal crosshair → rail controls (in group order) → ledger → beat content.
- Focus ring: 2px mint outline with a 2px `bg` offset.
- **Canvas points have a DOM proxy.** In beat 3, a visually hidden listbox lists all 400 customers ("#276 · 10 mo · $55.20 · p 0.217 · churned"), and arrow keys move the selection, mirrored on the canvas.
- **Touch:**
  - The crosshair needs a 44px hit target.
  - Point selection uses quadtree nearest-neighbor within 22px.
  - On touch, vertical page scroll is preserved: a drag on the terrain starts editing only if it begins on the crosshair.
- **Live region:** the probability verdict is announced through `aria-live="polite"`, debounced 500ms: "Churn probability 0.092, below threshold, retain side."

## Performance contract (for the engineer)

- ONNX runs in a dedicated **Web Worker** with a **batched** inference path. The ONNX inputs have a dynamic batch dimension; verified locally that batched outputs equal single-row outputs.
- Requests carry a monotonically increasing `seq`. Stale results are dropped, and only the latest pending request is kept.
- Budget targets on a mid-range laptop:
  - single row < 16ms;
  - coarse grid (384 rows) < 50ms;
  - full grid (1,536 rows) < 150ms.
- If the full grid exceeds 250ms twice, downgrade the default to 32×24 and show `grid 32×24 · adaptive` in the ledger.
- Parity: extend `tests/onnx-parity.test.ts` to all 400 rows, plus a batched-equals-single test. Rows 25 and 364 currently deviate by 0.007 and 0.012 from sklearn. Investigate, then make the site copy match the measured result.
