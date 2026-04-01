# Product Requirements Document

## Product Overview

`drive-reader` is an Expo-based mobile app for reading and handling text captured from local files, shared content, deep links, and Naver blog pages.

## Problem Statement

Users need a simple way to extract readable text from content sources that are awkward to consume directly on mobile, especially Naver blog posts and shared file content.

## Goals

- Load text from local files and shared inputs.
- Extract readable body text from Naver blog URLs.
- Save extracted content as a snapshot for later reading.
- Share extracted or loaded content onward.
- Keep the experience fast enough for day-to-day mobile use.

## Non-Goals

- Full blog archiving or synchronization service.
- Server-side processing pipeline.
- General-purpose web scraping beyond the supported content sources.
- Long-term content storage beyond local snapshot behavior.

## Primary User Flows

1. User opens the app and sees current text or shared content.
2. User pastes a Naver blog URL.
3. App extracts the readable body text.
4. User saves the result as a local snapshot or shares it.
5. User loads a local file or shared file and reads it in the same interface.

## Functional Requirements

- The app must accept text input, local file URIs, and supported share-intent content.
- The app must recognize Naver blog URLs and normalize mobile or desktop variants.
- The app must extract article text from the best available page source.
- The app must provide a saved snapshot state for extracted blog content.
- The app must show status messages for success, failure, and busy states.

## Validation Requirements

- Basic linting must pass before changes are considered stable.
- Golden tests should cover the expected Naver extraction output shape.
- Live validation should be used when the Naver page structure may have changed.

## Technical Direction

- Keep the app state-driven and local-first.
- Prefer small, testable extraction helpers over large monolithic parsing logic.
- Treat Naver extraction as a maintainable integration, not a fixed one-time parser.

## Release/Versioning Approach

- Use Git as the source of truth for code history.
- Use GitHub for remote version control and collaboration.
- Record daily progress in `docs/daily-log.md`.
- Update `docs/development-status-next.md` whenever the roadmap or current status changes.

## Open Questions

- Should the app support additional content sources beyond Naver and local files?
- Should snapshots remain ephemeral or become a more structured local archive?
- What is the target release cadence for GitHub-based milestones?

