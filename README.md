# codex-pr-reviewer

`codex-pr-reviewer` is a small CLI that helps maintainers pre-review pull requests for Codex-assisted workflows.

It gives a quick risk score, highlights likely review blockers, and keeps the review surface small enough to scan quickly.

## Why this matters

Maintainers need a fast way to decide which pull requests deserve a deeper human pass before merge. This project turns that decision into a short score and a few concrete notes.

## What it checks

- large diffs
- package or dependency changes
- missing tests
- rename-heavy changes
- docs-only changes

## Typical output

```text
Codex PR review score: 75/100
Target: /path/to/pr
Risk level: medium

- [HIGH] Package files changed without tests
  A package or dependency change should usually ship with at least one test or verification step.
```

## Usage

```bash
npm install
node ./bin/codex-pr-reviewer.js review .
```

JSON output:

```bash
node ./bin/codex-pr-reviewer.js review . --json
```

Repository-specific tuning:

```json
{
  "thresholds": {
    "largeDiffFiles": 40
  }
}
```

Place that in `.codex-pr-reviewer.json` at the repo root to adjust defaults per repository.

## GitHub integration

The repository is designed to support maintainer workflows with:

- a composite GitHub Action wrapper
- issue templates
- a pull request template
- Codex-friendly `AGENTS.md` guidance

## Docs

- [FAQ](./docs/faq.md)
- [Roadmap](./docs/roadmap.md)
