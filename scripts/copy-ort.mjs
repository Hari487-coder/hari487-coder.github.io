// Copy the ONNX Runtime WebAssembly binaries into public/ so they are served
// from this site's own origin.
//
// Why: the import page runs Whisper in the browser, and by default the runtime
// WASM would be fetched from a third-party CDN. Any code executing on this
// origin can read localStorage, which is where the Anthropic and GitHub tokens
// live. Same-origin runtime keeps "no third-party executable code" true.
//
// These are copied at build time rather than committed: 37MB of binaries would
// bloat every clone, and copying guarantees they match the installed
// onnxruntime-web version instead of silently drifting.

import fs from 'node:fs';
import path from 'node:path';

const SOURCE = path.join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist');
const TARGET = path.join(process.cwd(), 'public', 'ort');

// Every ort-wasm-* asset: the runtime picks a variant from the browser's
// capabilities at load time, and each .wasm needs its .mjs loader beside it.
// Shipping a subset means a browser that picks a missing variant fails with
// "no available backend found".
const NEEDED = fs
  .readdirSync(SOURCE)
  .filter((f) => /^ort-wasm-.*\.(wasm|mjs)$/.test(f));

if (!fs.existsSync(SOURCE)) {
  console.error(`[copy-ort] onnxruntime-web not installed at ${SOURCE}`);
  process.exit(1);
}

fs.mkdirSync(TARGET, { recursive: true });

let copied = 0;
for (const name of NEEDED) {
  const from = path.join(SOURCE, name);
  const to = path.join(TARGET, name);
  if (!fs.existsSync(from)) {
    console.error(`[copy-ort] missing ${name} in onnxruntime-web/dist`);
    process.exit(1);
  }
  // Skip when already present and the same size, so repeat builds stay fast.
  if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) continue;
  fs.copyFileSync(from, to);
  copied++;
}

console.log(`[copy-ort] ${copied} file(s) copied, ${NEEDED.length} in place at public/ort/`);
