# Typography (approved)

## Families

The site uses two families and no others. Both are free under the SIL Open Font License. I checked both on 2026-10-08, and both are served by `fonts.googleapis.com/css2` with HTTP 200.

| Role | Family | Source | Axes / weights used |
|---|---|---|---|
| Editorial sans: headings, captions, UI labels, body | **Bricolage Grotesque** | https://fonts.google.com/specimen/Bricolage+Grotesque | variable `opsz` 12–96, `wght` 300, 400, 600, 800 |
| Technical mono: every number, feature names, model metadata, ledger | **JetBrains Mono** | https://fonts.google.com/specimen/JetBrains+Mono | variable `wght` 400, 500, 700 |

**Self-host** the two variable WOFF2 files under `site/public/fonts/`. That avoids a third-party request on a site that already ships about 14 MB of wasm, and it lets the site work offline.

- Use `font-display: swap`.
- Preload Bricolage only.
- Fallbacks:
  - Bricolage: `system-ui, -apple-system, "Segoe UI", sans-serif`
  - JetBrains Mono: `ui-monospace, "SF Mono", Menlo, monospace`

Use `font-variant-numeric: tabular-nums slashed-zero` on all mono numerals. JetBrains Mono's figures are tabular by default. Slashed zero keeps `0.10` unambiguous.

## Scale

Sizes are fluid. `clamp()` runs from 390px to 1440px, and values are min → max.

| Token | Family / weight | Size | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `display` | Bricolage 800, opsz 96 | 56 → 128px | 0.92 | −0.035em | beat claims ("Four hundred customers.") |
| `h1` | Bricolage 600, opsz 72 | 40 → 80px | 0.98 | −0.025em | section heads |
| `h2` | Bricolage 600, opsz 48 | 28 → 44px | 1.05 | −0.015em | panel heads (Lab, SHAP) |
| `lede` | Bricolage 400, opsz 24 | 19 → 24px | 1.4 | −0.005em | caption over terrain |
| `body` | Bricolage 400, opsz 14 | 16 → 17px | 1.55 | 0 | prose, max 56ch (over canvas, max 44ch) |
| `label` | Bricolage 600, opsz 12 | 12 → 13px | 1.2 | +0.06em, UPPERCASE | control labels, axis titles |
| `num-hero` | JetBrains 500 | 48 → 96px | 1.0 | −0.02em | live probability in the Lab (`0.217`) |
| `num-lg` | JetBrains 500 | 22 → 32px | 1.1 | −0.01em | metric values (ROC-AUC 0.845) |
| `num` | JetBrains 400 | 13 → 14px | 1.35 | 0 | ledger, tooltips, point tag |
| `micro` | JetBrains 400 | 11px | 1.3 | +0.02em | axis ticks, provenance suffixes (`· sample n=400`) |

## Rules

1. **Provenance split.** If a model, a fixture or a computation produced a value, it is set in **JetBrains Mono**. If a human wrote it, it is set in **Bricolage**. The rule includes feature names in their raw form (`Contract`, `MonthlyCharges`) wherever they act as data. Human-readable feature names in prose ("contract type") use Bricolage.
2. **Probability formatting.**
   - Use 3 decimals: `0.217`.
   - A percent is allowed as a secondary mono value: `21.7%`.
   - **Never print `0` or `1`.** The fixtures contain exact 0.0 (2 rows) and 1.0 (3 rows) from isotonic calibration. Show these as `<0.001` and `>0.999`, and as `<0.1%` and `>99.9%`.
3. **SHAP formatting.** Show a sign and 2 decimals with a unit: `+0.72 log-odds`. Never show a percent.
4. **Live dot.** A LIVE value is preceded by a 4px mint dot. The dot scales from 1 to 1.6 to 1 over 240ms once per completed inference. Reduced motion: the dot does not scale, and the value briefly underlines in mint for 400ms instead.
5. **Line length.** Body text is 45–56ch. Captions placed on the terrain are at most 44ch, and they sit on a `bg/70` backing with 12px padding so they stay legible over the field.
6. **No all-caps above the 13px `label` size.** No italics in mono.
