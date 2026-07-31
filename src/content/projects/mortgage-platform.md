---
title: Mortgage Records Platform
summary: Public-records pipeline that turns county mortgage filings into direct-mail campaigns for a US insurance client.
stack: [TypeScript, Next.js, Fastify, PostgreSQL, Prisma, Docker, nginx]
status: live
date: 2026-07-28
featured: true
icon: lucide:landmark
---

New-mortgage public records are a strong signal for insurance outreach, but they arrive as
messy county filings. This platform collects them, normalizes them, and turns them into
direct-mail campaigns for a US insurance client.

A pnpm/TypeScript monorepo: collector engine, API, and an authed web app for browsing
leads and managing campaigns. Runs self-hosted on a VPS with docker-compose (Postgres 16,
API, web, nginx), after outgrowing the managed-hosting stack it started on.

Hard rules learned early and enforced in code: purchased records are direct-mail only and
must never become dialable contacts in the client's CRM, and opt-outs always win. The
current phase is a reliability sprint (backups, uptime monitoring, bot protection shipped)
before any wider rollout.
