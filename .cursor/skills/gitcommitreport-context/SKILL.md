---
name: gitcommitreport-context
description: >-
  Project context for gitcommitreport: a static React web app that reports
  GitHub repository contributors and is hosted on GitHub Pages. Use when
  working on this repo, scaffolding or changing the React app, contributor
  report UI, GitHub API usage, or GitHub Pages deploy/base path.
---

# gitcommitreport context

this is a static react web app that is meant to make a report that shows all the contributors in a git hub repository.

This is meant to be hosted on github pages.

## Constraints

- Prefer a client-only SPA (no backend/server runtime).
- Report focus: list/show all contributors for a GitHub repository.
- Deploy target: GitHub Pages (static build output; respect `base`/asset paths when scaffolding).
- Do not assume server-side secrets or SSR frameworks unless the user explicitly changes direction.
