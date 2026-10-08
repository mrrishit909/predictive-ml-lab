# Colors (approved)

The five mandated colors are fixed. The rest are neutrals derived from the background. Do not introduce hues beyond mint and coral.

## Tokens

| Token | Hex | Contrast on `bg` | Use |
|---|---|---|---|
| `--bg` | `#0B1110` | – | page, terrain floor at p = threshold, canvas clear color |
| `--mint` | `#B5FFCE` | 16.5:1 | **retention side** (p < threshold): terrain basin, "lowers risk" bars, focus rings, live-dot, primary interactive accent |
| `--ivory` | `#F0F3EB` | 17.0:1 | headlines, body, real-customer point fill, numerals |
| `--coral` | `#FF866D` | 8.1:1 | **churn side** (p ≥ threshold): terrain, "raises risk" bars, the threshold contour/rule, error states |
| `--gray` | `#87928B` | 5.9:1 | axes, tick labels, metadata, DERIVED numbers, secondary copy (AA for body text) |
| `--surface-1` | `#121A18` | – | instrument rail, popovers, tooltips |
| `--surface-2` | `#18221F` | – | hovered rows, pressed controls |
| `--line` | `#24302C` | – | hairlines, grid ticks, dividers (non-text only) |
| `--gray-dim` | `#5E6862` | 3.3:1 | disabled controls, large (≥24px) de-emphasized labels only; **never body text** |

### Alpha variants

These are the only ones allowed:

- `mint/12`, `mint/22`, `mint/40`
- `coral/16`, `coral/38`, `coral/60`
- `ivory/35`, `ivory/70`

## Semantic rules

1. **Mint means "below the threshold" and coral means "at or above the threshold".** The threshold is always **0.10** (`calibrators.json`, cost-optimal at FN $500 / FP $50). The only exception is a metric explicitly labeled `@0.50`.
2. **Ivory is truth and identity.** Points are ivory-filled when they are uncolored (the Data beat). The `actual_churn = 1` marker is an **ivory 1px ring** at radius + 2px, never a color, so the ring works on top of either class color.
3. **Gray means derived or secondary.** Gray is never used for a LIVE value.
4. **Coral is not "bad" decoration.** Coral appears only where a prediction or contribution is on the churn side, or for errors. It is never used for emphasis.

## Terrain ramp

The ramp is diverging and centered on the threshold, not on 0.5. The input is the calibrated probability p. Map it through logit space so that the narrow 0–0.10 band gets visual room:

```
t = logit(clamp(p, 0.001, 0.999))        // logit(0.10) = -2.197
t <  logit(0.10):  mix(bg, mint, alpha = 0.22 * s),  s = (logit(0.10) - t) / (logit(0.10) - logit(0.001))
t >= logit(0.10):  mix(bg, coral, alpha = 0.38 * s), s = (t - logit(0.10)) / (logit(0.999) - logit(0.10))
```

- Exactly at the threshold, the terrain is `--bg`. The boundary reads as a dark valley, and the coral contour line sits in it.
- **Iso-lines** are drawn at p = 0.10 (coral, 1.5px, 60% alpha, with a 6px coral/16 glow), at 0.25 and 0.50 (ivory/35, 1px), and at 0.05 (mint/40, 1px, dashed 2/4).
  - When the 0.10 line does not exist in a slice, which happens for 174 of 400 customers, show the 0.25 and 0.50 lines anyway and set the status caption "No 0.10 boundary in this slice."

## Point encoding

| State | Fill | Stroke | Radius (desktop) |
|---|---|---|---|
| Data beat (no model yet) | ivory/70 | – | 2.5px |
| Predicted retain (p < 0.10) | mint | – | 2.5px |
| Predicted churn (p ≥ 0.10) | coral | – | 2.5px |
| Actually churned | *(as above)* | ivory ring 1px at r + 2 | – |
| Hovered | *(as above)* | ivory 1.5px | 4px |
| Focal / selected | ivory | mint 2px plus crosshair | 5px |
| Defocused (Prediction beat) | *(as above)* at 35% alpha | – | 2px |

## Color-vision redundancy

Mint and coral differ greatly in luminance (16.5 vs 8.1 contrast on bg), so they stay separable in grayscale. Color is never the only channel:

- **Predicted class:** the class is also stated in mono text (`churn side` / `retain side`). On the rail it is also given by position relative to the threshold.
- **Actual class:** the ring is the second channel.
- **Contribution direction:** bars grow right for "raises risk" and left for "lowers risk", with a `+` or `−` sign in mono.
