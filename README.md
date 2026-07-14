# gitcommitreport

Static React app that reports commit counts for contributors of a GitHub repository (bar chart). Hosted on GitHub Pages.

**Live URL (after Pages is enabled):** https://aivf-baisheng.github.io/gitcommitreport/

## Features

- Paste a GitHub repo URL (`https://github.com/owner/repo` or `owner/repo`)
- Choose a branch by typing anytime (including `origin/dev_main`, normalized to `dev_main`) or browsing loaded branches
- Optionally scan **all branches** (unique commits deduped by SHA)
- Bar chart of commits per contributor on that branch
- Exclude authors by name via checkboxes after generating a report
- Optional personal access token stored only in browser `localStorage`
- UI built with [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS

## Local development

```bash
npm install
npm run dev
```

The app is served under the Pages base path: http://localhost:5173/gitcommitreport/

```bash
npm run build
npm run preview
```

## GitHub token (optional)

Unauthenticated GitHub API access is tightly rate-limited. For larger repos, private repos, or fewer 403s:

1. Create a [personal access token](https://github.com/settings/tokens)
2. Scopes: `public_repo` for public repos, or `repo` for private repos (classic), or equivalent fine-grained repository read access
3. Open **Optional GitHub token** in the app, paste the token, and save

The token never leaves the browser except as the `Authorization` header to `api.github.com`.

## GitHub Pages deploy

Pushing to `main` runs [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), which builds the Vite app and deploys `dist`.

One-time setup in the GitHub repo:

1. **Settings → Pages → Build and deployment → Source:** GitHub Actions
2. Ensure the workflow has permission to deploy Pages

Vite `base` is set to `/gitcommitreport/` to match this repository name.
