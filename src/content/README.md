# This folder is an Obsidian vault

Open `src/content` as a vault in Obsidian (Open folder as vault) and you get the same
notes, links, and graph you see on the site.

- `courses/` one file per IITH course
- `notes/` lecture notes (the live recorder writes here)
- `assignments/` assignment tracker (the inbox's Track button writes here)
- `projects/` project writeups

Link anything to anything with `[[wikilinks]]`: `[[em5090]]`, `[[EM5090]]`, the exact
title, or `[[em5090|a custom label]]`. Those links work in Obsidian and render as real
links on the site, and they draw the edges on https://hari487-coder.github.io/graph/.

Edit here, commit, push. The site rebuilds and matches within a couple of minutes.

Frontmatter rules for each folder live in the repo's CLAUDE.md. Keep them valid: a bad
date or a missing field fails the site build rather than publishing something broken.
