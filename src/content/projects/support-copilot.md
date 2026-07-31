---
title: Support Copilot
summary: Zero-cost agent-assist chat that answers support questions from resolved tickets and docs, no LLM API required.
stack: [Python, Flask, BM25]
status: parked
date: 2026-05-28
---

Support agents kept re-solving problems that had already been solved. The copilot is a
standalone chat that searches thousands of resolved tickets and the product docs with
BM25 ranking and hands back the closest prior resolutions, with citations.

The deliberate constraint: zero marginal cost. No LLM API in the loop, so it can run
all day for a whole team without a bill. Retrieval quality came from curating what counts
as a "resolved" ticket and boosting doc sections that agents actually quote.

Built, working, and parked: the team's workflow moved toward code-grounded triage (reading
the actual backend source to diagnose) which beat similarity search for hard tickets.
Logged here because parked work is still work, and the corpus tooling got reused.
