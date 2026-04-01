# Testing Strategy

## Current Coverage

- `npm run lint` for code style and static issues.
- `npm run test:naver` for golden Naver extraction output.
- `npm run test:naver-live` for live Naver extraction checks.
- `npm run qa:workflow` for web UI smoke coverage.
- GitHub Actions runs lint, typecheck, and the workflow QA smoke test on push and pull request.

## What `qa:workflow` Verifies

- The main workflow entry points are visible.
- The help page opens and returns to the app.
- Input mode selection works.
- The preview panel expands and collapses.
- The preview content area is scrollable.

## Expo Go / Native Automation Strategy

Expo Go itself is not a good target for DOM-style automation. The practical options are:

1. Keep Expo Go for manual device verification.
2. Use web QA for cheap and repeatable interaction coverage.
3. If native automation is needed, move to a dev-client build and add a native runner such as Detox or Appium.

## Recommended Path

- Keep `qa:workflow` as the fast smoke test.
- Use Expo Go for manual QA on gestures, keyboard behavior, and native file/share flows.
- Add native automation only after the UI stabilizes enough to justify the setup cost.
