# Concept B: MARGIN NOTES

## Visual thesis

The model reads like an annotated broadsheet.

PREDICTIVE becomes a **text-led editorial stepper**. Each of the six beats is one "page", and you advance with discrete steps (keyboard ←/→, swipe, or scroll-snap). Steps are not continuous scroll.

The spine of every page is a single horizontal **threshold rail**: a logit-scaled calibrated-probability axis from <0.1% to >99.9%, with the 0.10 threshold as a coral rule. The 400 real customers sit on it as a tight beeswarm.

The Prediction Laboratory is an **explorable sentence**:

> "A *female* customer, *10* months in, paying *$55.20* a month on a *month-to-month* contract with *DSL*…"

Every italic word is an inline control. Behind the sentence, her dot slides along the rail as the real model re-scores her. This concept is the most literal and the most legible: numbers and words carry the meaning, and the marks act as footnotes.

## Palette

The mandated five are used as given. Ivory dominates as *ink*, while mint and coral are rationed to data marks only.

| Token | Hex | Role |
|---|---|---|
| bg | `#0B1110` | page |
| ivory | `#F0F3EB` | body text (the hero here), headlines |
| mint | `#B5FFCE` | retention-side marks, inline-control underline |
| coral | `#FF866D` | churn-side marks, threshold rule |
| gray | `#87928B` | marginalia, footnote numerals, axes |
| rule (added) | `#2A3531` | column rules, table hairlines |
| paper-shadow (added) | `#0F1715` | alternating table rows |

## Typography

- **Schibsted Grotesk** (Google Fonts, OFL, `wght` 400–900) for headlines and body. It was drawn for a news publisher, which suits the broadsheet voice. Headlines are set in heavy weights at 64–96px, and body text at 19px/1.5.
- **IBM Plex Mono** (Google Fonts, OFL, 400/500) for every number, marginal footnotes, and the inline-control values.

## Layout strategy

- A 12-column editorial grid. Text occupies columns 1–6 (max 56ch).
- **Marginalia** occupy columns 10–12: mono footnotes such as `¹ p computed live · 5 folds · {measured} ms`.
- The threshold rail spans columns 1–12 at the vertical golden section.
- Information density is high. Each page has a headline, about 120 words, the rail, one supporting figure (a small-multiple table, confusion grid or reliability strip), and footnotes.
- The chrome is substantial: page counter `03 / 06`, step dots and a table of contents.

## Opening storyboard (9.0 s)

1. **0–1.5 s.** A blank page. The headline sets word by word in heavy grotesk: "Four hundred customers. One threshold."
2. **1.5–3.5 s.** 200 seeded points (`d3.shuffler(d3.randomLcg(846))` subset of the real 400) fall like type into a single justified line beneath the headline. They are evenly spaced, in id order, like a row of glyphs.
3. **3.5–5.5 s.** The line "re-justifies". Each point slides to its real probability on the logit rail, and the beeswarm stacks upward.
4. **5.5–6.5 s.** A coral rule draws up through the rail at 0.10. Points to its right turn coral (≈ two-thirds) and points to its left turn mint. A footnote marker ¹ appears next to the rule.
5. **6.5–8.0 s.** One point (#276, p 0.217) lifts out of the swarm and floats up into the headline's baseline, replacing the period.
6. **8.0–9.0 s.** The headline cross-dissolves into the explorable sentence, and #276's values fill the italic slots.

The **Skip** link sits under the headline. With reduced motion, the final composed page shows immediately.

## Motion grammar

- **Typographic.** Movements are horizontal, decisive and short (140–220 ms), using an ease-out-quart curve. There are no springs.
- Elements "set" like type: they arrive and stop.
- Step transitions are a 240 ms crossfade plus an 8px vertical shift.

## Primary interaction: Prediction Laboratory

- The visitor clicks an italic word to get an inline popover. "month-to-month" opens as `month-to-month · one year · two year`.
- Numeric words (tenure, charge) are scrubbable: drag horizontally on the number.
- The dot on the rail glides to the new probability. The sentence's verdict clause rewrites itself, for example "…so the model **would flag** her (p 0.217 ≥ 0.10)."
- All 19 features are in the sentence. The less influential ones sit in a second "fine print" paragraph.

## Technical approach

- **SVG throughout.** There are 400 circles on one rail plus small figures, and SVG gives free accessibility, text crispness and CSS styling.
- No canvas is needed.
- ONNX runs single-row on the main thread, which is fine because there is one row per edit.

## Performance risk

- **Layout thrash from the reflowing sentence.** Every edit changes word widths, which re-wraps the paragraph and moves the inline controls under the pointer mid-drag.
- **Mitigation:** fixed-width slots (`ch` units) for each control value.
- The second risk is SVG beeswarm relayout (a force simulation) on every re-score. It must run only for the edited dot.
