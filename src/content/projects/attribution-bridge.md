---
title: Attribution Bridge
summary: Compliance-safe lead mover for a CRM, replaces manual contact copying with API creates that preserve consent attribution.
stack: [Node.js, Express, Render]
status: live
icon: lucide:git-branch
date: 2026-07-10
---

Copying a contact between CRM accounts silently strips the attribution that marks it as
compliant to call. Leads copied by hand were getting blocked by do-not-call gates, and
nobody could see why.

Attribution Bridge replaces the manual copy with API-created contacts that carry an
integration attribution stamp, so copied leads pass compliance checks legitimately. It
adds a pre-check that explains whether a number would be callable before moving it, a
channel test, and a backlog migration mode for fixing contacts copied the old way.

Small Express app, no database, runs on Render with a mock mode for safe testing. The
invariant that matters: opt-out always wins, and the bridge never manufactures consent
that was not actually given. Built for one white-label client and shipped.
