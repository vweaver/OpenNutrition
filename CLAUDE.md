# Instructions for Claude

This file tells Claude (and any contributor) how to work in this repo.

## Branch workflow

- **`master`** is protected and auto-deploys to GitHub Pages on every push.
- **Do not push directly to `master`.** All changes go through a branch.
- Create work on a short-lived branch, open a PR, get it green, then merge.

Typical flow:

```sh
git checkout -b dev/<short-topic>   # or feature/<topic>
# ... make changes ...
git push -u origin dev/<short-topic>
# open a PR targeting master; merge once CI is green
```

## Tests are required before deploy

Every push to `master` triggers `.github/workflows/deploy.yml`, which **runs
the full test suite as a gate** before building or deploying. If tests fail,
the site does not redeploy.

Run tests locally before opening a PR:

```sh
npm run check         # TypeScript + Svelte type checking
npm run test:unit     # Vitest unit tests (watch mode)
npm run test:unit -- --run   # single run, as CI does
npm run test:e2e      # Playwright end-to-end tests
npm test              # everything, CI-style
```

First time running Playwright locally, install the browser:

```sh
npx playwright install chromium
```

## Where tests live

- **Unit tests:** `src/**/*.test.ts` — Vitest. Use for pure functions, LLM
  prompt builders, schema validation, unit conversions, date helpers.
- **E2E tests:** `e2e/*.spec.ts` — Playwright. Spins up `npm run preview` and
  drives the real app. Use for navigation, PWA shell, and user flows.

Keep the test pyramid in mind: push logic down into pure TS modules where it
can be unit tested cheaply, and reserve E2E for things that genuinely need a
browser (DB init via sql.js, camera, OPFS, service worker).

## When you add a feature

1. Write or update the code on a branch.
2. Add/extend tests that would have caught the bug or verify the new behavior.
3. Run `npm test` locally. If anything fails, fix it before pushing.
4. Open a PR to `master`. The `CI` workflow will run again on the PR.
5. Merge when green. The deploy workflow takes over from there.

## When you fix a bug

Write a regression test first (that fails), then fix the code (test passes).

## Production URL

- https://vweaver.github.io/OpenNutrition/

## Useful commands

```sh
npm run dev           # local dev server on :5173
npm run build         # static build into build/ (needs BASE_PATH for GH Pages)
npm run preview       # serve the built output on :4173
BASE_PATH=/OpenNutrition npm run build   # matches CI build
```
