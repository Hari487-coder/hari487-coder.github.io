---
title: Assistable Media Bridge
summary: Open-source bridge that lets AI assistants on Assistable send images and files over SMS, three integration doors into one core.
stack: [TypeScript, Node.js, MCP, Render]
status: live
date: 2026-07-14
repo: https://github.com/Hari487-coder/assistable-media-bridge
live: https://hari487-coder.github.io/assistable-media-bridge/
featured: true
---

Assistable's AI assistants could not send media. Conversations that needed a menu photo, a
brochure, or a signed form dead-ended into "I'll have someone send that over."

The bridge fixes that with one core and three doors, so any account can pick its integration
depth:

- a Custom Tool endpoint the assistant calls directly from a conversation
- a media-only waker for accounts that just need attachments to go out
- a Streamable-HTTP MCP server for full tool-calling setups

Bring-your-own-key: each install runs against the account's own Assistable API key, so
nothing is shared and nothing routes through me. Deploys in one click on Render.

Shipped and in use by real accounts. The ugliest bug: multi-assistant accounts woke the
conversation's pinned assistant, which did not have the tool assigned. The fix assigns the
tool on wake, and it taught me more about the platform's conversation model than any doc.
