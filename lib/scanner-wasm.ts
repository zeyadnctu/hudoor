"use client";
import { setZXingModuleOverrides } from "@yudiel/react-qr-scanner";

/**
 * The QR engine (barcode-detector → zxing-wasm) resolves its WebAssembly
 * binary through locateFile(); the factory default points at a public CDN
 * (https://fastly.jsdelivr.net/npm/zxing-wasm@…/dist/reader/zxing_reader.wasm).
 * Our CSP connect-src blocks that origin, a CDN fetch fails offline anyway,
 * and WebAssembly compilation needs 'wasm-unsafe-eval' in CSP script-src.
 *
 * So: the binary is served same-origin from /public/zxing_reader.wasm and the
 * wasm-unsafe-eval CSP keyword is set in next.config.js. Without this, every
 * scan dead-ends with
 *   "Failed to execute 'detect' on 'BarcodeDetector':
 *    Barcode detection service unavailable."
 *
 * Import this module (for its side effect) in every page that renders
 * <Scanner>. Idempotent-friendly: overrides simply replace the defaults.
 */
setZXingModuleOverrides({
  // "/zxing_reader.wasm" — served from public/, same-origin, CSP-friendly.
  locateFile: (file: string) => `/${file}`,
});
