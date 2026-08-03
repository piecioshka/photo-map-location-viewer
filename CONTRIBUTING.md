# Contributing

Thanks for taking a look at the code. This document is the short version of
how the project is put together and what is expected from a change.

## Getting started

```bash
npm install
npm run dev        # dev server on the first free port from 3000
```

No environment variables are needed to run the app. Two optional ones enable
extra features (see [`.env.example`](.env.example)):

| Variable                | Effect when missing                  |
| ----------------------- | ------------------------------------ |
| `VITE_GOOGLE_CLIENT_ID` | the Google Drive button stays hidden |
| `VITE_SENTRY_DSN`       | error monitoring is not initialized  |

## How the app is organized

There is no backend and no framework — plain TypeScript modules with a small
amount of DOM wiring. The layering is the important part:

| Directory       | Responsibility                                                                |
| --------------- | ----------------------------------------------------------------------------- |
| `src/photo/`    | pure photo logic: EXIF reading, thumbnails, coordinate and date formatting    |
| `src/services/` | side effects and integrations: storage, geocoding, Google Drive, i18n, export |
| `src/ui/`       | DOM widgets: photo list, timeline, calendar, dialogs, theming                 |
| `src/map/`      | everything Leaflet — markers, clustering, route, flags, popups                |
| `src/features/` | self-contained features behind a flag, imported lazily                        |
| `src/main.ts`   | the orchestrator that wires the pieces together and owns the photo lifecycle  |

Two rules keep this workable:

- Logic worth testing lives in a pure function outside the DOM, so it can be
  covered by a unit test (see the `*.test.ts` files next to their modules).
- Widgets expose handles (`PhotoEntryHandle`, `PhotoMarkerHandle`, …) instead
  of letting callers reach into their DOM.

## Working on a change

```bash
npm run lint       # ESLint (type assertions are banned — use type guards)
npm run format     # Prettier over everything, including Markdown
npm test           # Vitest unit tests
npm run test:e2e   # Playwright against a production build
npm run build      # tsc --noEmit + production build
```

The same steps run in CI on every push and pull request. A pre-commit hook
runs ESLint and Prettier on staged files.

New work that is not ready for everyone goes behind a feature flag in
[`src/services/feature-flags.ts`](src/services/feature-flags.ts): add the flag
name, give it a `VITE_FF_*` default, and put the code in `src/features/` behind
a dynamic `import()` so a disabled feature ships nothing to the browser. Try it
with `?ff=<name>` without rebuilding.

House rules worth knowing before you write code:

- No `as` type assertions — model the types so they are provably correct, or
  narrow with `instanceof` / a type predicate. ESLint enforces this.
- No inline `style` attributes in HTML; put styling in `src/styles.css` and
  toggle classes (assigning `el.style.*` at runtime is fine).
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
  and are written in English.

## Privacy is a feature, not a detail

Photos never leave the device. Only two things go over the network on the
app's behalf: coordinates sent to the reverse-geocoding API to resolve city
names, and map tile requests. If a change would send anything else anywhere,
it needs to be called out explicitly in the pull request and reflected in the
privacy dialog and the README.
