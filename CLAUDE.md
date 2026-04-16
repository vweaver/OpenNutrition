# Instructions for Claude

This file tells Claude (and any contributor) how to work in this repo.

## Branch workflow

- **`master`** auto-deploys to GitHub Pages on every push.
- All changes start on a short-lived branch (`dev/<topic>` or `feature/<topic>`).
- **Claude handles the deploy.** Run the tests, and if they pass, merge the
  branch into `master` and push. The user should not have to open or merge
  PRs for routine changes.
- The deploy workflow itself re-runs the full test suite as a final gate, so
  a broken master won't reach production even if a local test was skipped.

Typical flow Claude follows:

```sh
git checkout -b dev/<short-topic>
# ... make changes ...
npm run check
npm run test:unit -- --run
npm run test:e2e           # skip only if the sandbox can't run browsers; CI will catch it
git checkout master
git merge --no-ff dev/<short-topic>
git push origin master
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

## When Claude adds a feature

1. Create a `dev/<topic>` branch.
2. Make the code change and add/extend tests that would have caught the bug
   or verify the new behavior.
3. Run `npm run check` and `npm run test:unit -- --run`. Run `npm run test:e2e`
   if the sandbox can launch a browser.
4. Merge the branch into `master` with `--no-ff` and push.
5. The deploy workflow runs the full suite again and deploys on success.

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
