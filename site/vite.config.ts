import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages project-site base path: https://mrrishit909.github.io/predictive-ml-lab/
export default defineConfig({
  base: '/predictive-ml-lab/',
  plugins: [react()],
  optimizeDeps: {
    // onnxruntime-web's default build statically resolves its wasm binaries
    // via import.meta.url, which makes Vite bundle a 28MB wasm asset inline
    // instead of using the small, explicitly-versioned copies self-hosted at
    // public/onnx/. Excluding it from dependency pre-bundling/optimization
    // keeps it as a plain runtime import so ort.env.wasm.wasmPaths (set in
    // src/inference/churnModel.ts) is what actually resolves the binary.
    exclude: ['onnxruntime-web'],
  },
})
