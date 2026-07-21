# End-to-End Tests

Playwright + TypeScript suite covering the anonymous user journey on SarkariPYQ.

## What's covered

- **Home → Exam card → Practice** — the only journey currently wired up.
- **Hero CTA → Practice** — secondary click path on the same hero.

Both tests are credential-free and rely only on the public, anonymous flows
exposed by the app, so they are safe to run in CI without any secrets.

## First-time setup

```bash
cd frontend
npm install                       # picks up @playwright/test
npm run e2e:install               # downloads the Chromium binary
```

## Running tests

```bash
npm start                         # in one terminal — boots CRA on :3000
npm run e2e                       # in another — runs the suite headless
```

Playwright will reuse an already-running dev server thanks to
`reuseExistingServer: true` in `playwright.config.ts`, so you can also
just run `npm run e2e` on its own — it will boot the server for you.

Useful variants:

| Command | Purpose |
| --- | --- |
| `npm run e2e` | Headless run, default reporter |
| `npm run e2e:headed` | Watch the browser while the test runs |
| `npm run e2e:ui` | Launch Playwright's interactive UI mode |
| `npm run e2e:report` | Open the last HTML report after a run |

## Layout

```
frontend/
├── e2e/
│   └── home-to-practice.spec.ts   # the spec(s)
├── playwright.config.ts           # shared config
├── tsconfig.e2e.json              # TS config for tests (extends base)
└── package.json                   # `e2e*` scripts + @playwright/test dep
```

## Notes for new tests

- Prefer user-facing locators: `getByRole`, `getByLabel`, `getByText`,
  `getByPlaceholder`. Avoid CSS/XPath.
- Use the existing page objects (`HomePage`, `PracticePage`) as a template
  when adding new flows.
- Keep tests independent — never rely on execution order. Use
  `test.beforeEach` for per-test setup, not module-level state.
- Anything that requires login (e.g. bookmarking, attempt submission)
  should be added as a separate spec with its own `storageState` setup
  rather than mixed into the anonymous suite.
