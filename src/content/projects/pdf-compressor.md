---
title: PDF Compressor
summary: Client-side PDF compressor built for IITH portal upload limits, files never leave the browser.
stack: [JavaScript, pdf.js, GitHub Pages]
status: live
date: 2026-05-20
repo: https://github.com/hari487-coder/pdf-compressor
live: https://hari487-coder.github.io/pdf-compressor/
featured: true
---

IITH's application portal caps PDF uploads hard, and every online compressor wants your
document on their server. Application documents are exactly the files you do not want
uploaded to a random server.

So this one compresses entirely in the browser: pdf.js rasterizes each page, the pages
re-encode at a quality level chosen by binary search to land just under the target size,
and the result downloads without a single byte leaving the machine.

One gotcha worth logging: browsers throttle requestAnimationFrame in background tabs,
which silently stalled compression when you switched tabs to do something else while
waiting. The fix was driving progress off timers instead. Free, static, no accounts,
hosted on GitHub Pages.
