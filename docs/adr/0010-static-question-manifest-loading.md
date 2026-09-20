# ADR 0010: Load large question banks as static PWA assets

- Status: Accepted
- Date: 2026-09-20

## Context

The original eight-question manifest was imported directly by the Web source. A committed computer-network bank adds more than 500 questions and about one megabyte of JSON. Bundling that data into the application entry chunk would increase JavaScript parse cost and couple UI builds to a particular bank.

## Decision

Published manifests remain canonical files under `content/`. A small Vite plugin serves them at stable `/content/*.json` paths during development and emits the same files during production builds. The Web app fetches, independently validates and deterministically merges the original and external manifests at startup. Duplicate IDs fail before a question index is created.

Workbox precaches emitted JSON and `question-assets/**/*`, so a completed first visit supports offline reload. Only study attempts, favorites, reviews and settings live in IndexedDB. Session construction filters taxonomy and learning state, applies one random or sequential ordering step, takes the requested count and then keeps that queue fixed.

## Consequences

- The main JavaScript bundle does not scale with question-bank size.
- A startup loading/error state is required before practice is available.
- Adding a published bank requires updating the explicit static manifest list and passing merge validation.
- Offline readiness includes both manifests and referenced prompt images.
