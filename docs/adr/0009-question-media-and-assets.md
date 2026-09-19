# ADR 0009: Prompt image media and stable asset paths

- Status: Accepted
- Date: 2026-09-19

## Context

Question Domain v2 represented prompts as plain text. Source audits showed that legitimate technical questions may also require diagrams. Storing local filesystem paths would make manifests machine-specific, while accepting arbitrary markup would expand the rendering and security boundary beyond the needs of the first content releases.

## Decision

Questions may carry an optional `media` array. Its first version supports only `{ type: "image", src, alt }`. Both text fields are required, and `src` must use `/question-assets/<source>/<file>` under `apps/web/public/question-assets/`.

Media is part of `QuestionPrompt`, so it is safe to render before submission. The answer projection remains unchanged. The Web renderer uses ordinary responsive `img` elements and replaces failed images with a non-blocking text notice. No Markdown, arbitrary HTML, rich text, lightbox or remote media transport is introduced.

Dedicated importers normalize source-relative image paths with the shared helper, then remain responsible for verifying existence, copying assets, detecting collisions and recording provenance. Importers must quarantine invalid or missing media rather than guess.

## Consequences

- Existing questions remain valid because `media` is optional and may be empty.
- Static question images are versioned with the Web app and included in PWA precaching.
- Supporting audio, video, attachments or rich text requires a later explicit schema and renderer decision.
