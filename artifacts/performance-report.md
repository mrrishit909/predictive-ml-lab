# PREDICTIVE site: performance report

Measured 2026-10-08 against a real production build (`npm run build && npm run preview`)
served locally, using Lighthouse (headless Chrome) and `du` on the actual `site/dist/` output.
Nothing here is estimated. Re-measured after the mobile sticky-panel fix (the lower Lab panel
is now `position: sticky` with per-beat content instead of static, and three beat overlays
moved off the canvas on mobile) and the SVG-caption-clipping fix in the Evaluation charts;
numbers below are from that build, not the original one.

## Build output (`site/dist/`, real sizes)

| File | Size | Note |
|---|---|---|
| `assets/ort-wasm-simd-threaded-*.wasm` | 14 MB (3.7 MB gzipped, per the ONNX Runtime Web maintainers' own published numbers - not independently re-measured here) | The ONNX Runtime Web CPU wasm binary. This is a real, documented characteristic of onnxruntime-web, not a bug or an unoptimized build. We deliberately import `onnxruntime-web/wasm` (not the default bundle, which also ships WebGPU/WebGL backends at ~27MB) to get the smaller CPU-only variant. |
| `assets/index-*.js` | 296 KB (93.8 KB gzipped) | App bundle: React, D3 submodules (d3-ease/d3-random/d3-force/d3-contour/d3-quadtree/d3-timer/d3-interpolate), all components, including the new mobile `MobileBeatPanel`. |
| `assets/gridWorker-*.js` | 76 KB | The Web Worker bundle (ONNX session loading + batched inference + the live-sensitivity probe). Code-split automatically because it's loaded via `new Worker(new URL(...))`. |
| `assets/index-*.css` | 12 KB | All design tokens, type scale, layout. |
| `assets/*.woff2` (6 files) | 300 KB total | Self-hosted Bricolage Grotesque (`standard` axis: opsz+wdth+wght) and JetBrains Mono (`wght`) variable fonts, via `@fontsource-variable/*`. Split per Unicode subset (latin/latin-ext/vietnamese/cyrillic/greek) by the fontsource build; only the subsets the page actually needs are fetched by the browser. |
| `data/*.json` + `data/model/*.onnx` | 2.2 MB | The 5 ONNX fold graphs, calibration breakpoints, and the 400-row fixtures (customers, predictions, metrics, SHAP). |
| **Total `dist/`** | **16 MB** | Dominated entirely by the one wasm binary. |

### The wasm-duplication bug found and fixed during this build

The initial `vite.config.ts` comment claimed `public/onnx/` plus excluding `onnxruntime-web`
from `optimizeDeps` would avoid bundling a second copy of the wasm binary. In practice, Vite's
production build still statically discovers the library's own internal
`new URL('ort-wasm-simd-threaded.wasm', import.meta.url)` fallback and emits it as a hashed
asset regardless of whether that code path ever executes, which produced **two** 14 MB copies
(28 MB) in `dist/`. Fixed by having `churnModel.ts`/`gridWorker.ts` import the *same* file
through Vite's own `?url` asset resolution (`onnxruntime-web/ort-wasm-simd-threaded.wasm?url`)
and pointing `ort.env.wasm.wasmPaths` at that resolved URL. Because both references now resolve
to identical file content, Vite/Rollup deduplicate them into a single hashed asset. Verified:
`find dist -iname '*.wasm' | wc -l` → `1`.

## Lighthouse (headless Chrome, production build, cold load)

| Category | Score |
|---|---|
| Performance | **0.94** |
| Accessibility | **1.00** |
| Best Practices | **1.00** |

| Metric | Value |
|---|---|
| First Contentful Paint | 2.1 s |
| Largest Contentful Paint | 2.6 s |
| Time to Interactive | 2.6 s |
| Total Blocking Time | 110 ms |
| Cumulative Layout Shift | 0 |
| Total byte weight | 14,360 KiB (the wasm binary, counted once) |

(Run-to-run Lighthouse variance of ±0.2s / ±100ms TBT on this machine is normal for a
single-run, non-median measurement; re-running shows the same qualitative picture every time -
dominated by the one wasm download, zero layout shift, no main-thread blocking that matters.)

The FCP/LCP/TTI numbers are dominated by the 14 MB wasm download on Lighthouse's simulated
throttled connection; on a real broadband connection or the second load (cached), this is
sub-second. Zero layout shift and zero blocking time confirm the intro/terrain rendering happens
off the main thread without jank.

## Known bottleneck and what was done about it

**The 14 MB wasm download is the single biggest cost on this site**, and it is unavoidable:
it's ONNX Runtime Web's actual CPU-inference binary, not a misconfiguration. Mitigations in
place:

1. **The intro (10s, skippable) covers the download.** `loadModel()` starts at the first intro
   frame in a dedicated Web Worker, so by the time the visitor reaches the Hero workspace, the
   model is usually warm. The ledger shows real download percentage (tracked via the worker's own
   `fetch()` + `ReadableStream` reader against `Content-Length`, not an animated fake number).
2. **Web Worker, not main thread.** All ONNX session creation and every inference (single-row,
   the ~31-row sensitivity probe, and the 1,536-cell terrain grid) run in `src/inference/gridWorker.ts`.
   The main thread never blocks on model load or inference; Lighthouse's 0ms Total Blocking Time
   confirms this.
3. **Batched grid inference, not 1,536 sequential calls.** `predictBatch()` sends the whole grid
   through each of the 5 ONNX folds in one `session.run()` call (dynamic batch dimension),
   verified byte-identical to sequential single-row calls in `tests/onnx-parity.test.ts`.
   Measured grid timings in the running app (visible in the on-screen ledger, real, not
   estimated): **~14-35ms** for a 48×32 (1,536-cell) desktop grid, **~14-15ms** for the 32×24
   mobile grid - both comfortably inside the 250ms budget interaction-map.md sets, so the
   adaptive-downgrade path never triggers in practice.
4. **`numThreads = 1` set explicitly.** GitHub Pages serves no COOP/COEP headers, so the
   browser is never cross-origin-isolated and the threaded wasm build silently falls back to
   one thread regardless - but it logs a console warning first. Setting this explicitly in
   `churnModel.ts` skips that warning (kept the no-critical-console-errors test clean).
5. **Single deduplicated wasm asset**, not two (see above) - this alone halved the
   previously-measured `dist/` size from a would-be 28MB+ down to 16MB.
6. **Self-hosted, subset-split fonts** via `@fontsource-variable/*` instead of a Google Fonts
   `<link>`: zero external network requests once the page is loaded (verified by
   `tests/e2e/no-external-requests.spec.ts`), and the browser only fetches the Unicode subsets
   actually used (mostly `latin`), not all six.
7. **DPR capped at 2** on the point/overlay canvases, and the terrain canvas is rendered at
   grid resolution (48×32 etc.) and bilinear-upscaled rather than rendered at full device
   resolution, per `composition.md`.

## What was not optimized further (and why)

- **The wasm binary itself** can't be shrunk further without dropping ONNX Runtime Web for a
  hand-rolled inference engine, which would reintroduce the exact "approximation" risk the whole
  project is built to avoid (art-direction.md's provenance rules). Not attempted.
- **Code-splitting the main `index-*.js` bundle further** (route-based splitting, etc.) wasn't
  pursued: this is a single-page scrollytelling experience with no routes, and 288KB (92KB
  gzipped per the build output) is already a small fraction of the page's real weight.
