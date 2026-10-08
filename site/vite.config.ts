import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages project-site base path: https://mrrishit909.github.io/predictive-ml-lab/
export default defineConfig({
  base: '/predictive-ml-lab/',
  plugins: [react()],
  optimizeDeps: {
    // onnxruntime-web's wasm-loading code is only reachable at runtime, not
    // through normal static imports; pre-bundling it during dev breaks that.
    // The actual wasm binary (ort-wasm-simd-threaded.wasm, ~14MB) is loaded
    // via an explicit `?url` import in churnModel.ts/gridWorker.ts, which
    // Vite serves/hashes as a single deduplicated asset - see the comment
    // there for why that specific import shape matters.
    exclude: ['onnxruntime-web'],
  },
  worker: {
    // The grid worker (src/inference/gridWorker.ts) dynamically imports
    // onnxruntime-web, which needs ES module code-splitting. Vite's default
    // worker bundle format is 'iife', which can't contain a dynamic import.
    format: 'es',
  },
})
