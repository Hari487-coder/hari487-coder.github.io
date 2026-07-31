---
title: Client Intelligence Portal
summary: Support analytics warehouse for an AI startup, unifies tickets, chat, and billing into one queryable picture of customer health.
stack: [Python, DuckDB, Flask, GitHub Actions]
status: internal
date: 2026-06-15
featured: true
icon: lucide:database
---

An AI startup's support signal was scattered across a ticketing tool, Discord, email, and
billing. Nobody could answer "which issues are systemic" or "who is about to churn"
without opening five tabs.

The portal is a DuckDB warehouse fed by a scheduled sync every three hours, with a Flask
front end the team actually opens: executive dashboard, per-client health, a
voice-of-customer layer that classifies cancellation reasons and feature requests, and
auto-generated dev briefs for each systemic issue.

The unglamorous parts were the real work: a source API that silently dropped about 3% of
records per paginated walk (fixed by reconciling by ID), shift-aware response-time metrics
so overnight gaps stop poisoning averages, and excluding a reseller's downstream customers
from churn math. Internal tool, so no link, but it runs every day.
