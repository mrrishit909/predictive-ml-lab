/// <reference types="vite/client" />

// vite/client.d.ts declares `*.wasm?init` and `*.wasm` but not the plain
// `?url` suffix used in src/inference/churnModel.ts to get onnxruntime-web's
// wasm binary's final hashed URL without duplicating the asset.
declare module '*.wasm?url' {
  const src: string
  export default src
}
