# codex-pr-reviewer

[![CI](https://github.com/warren2008-2020-spec/codex-pr-reviewer/actions/workflows/ci.yml/badge.svg)](https://github.com/warren2008-2020-spec/codex-pr-reviewer/actions/workflows/ci.yml)

`codex-pr-reviewer` is a small CLI for maintainers who want a fast, opinionated PR pre-review before merge.

It focuses on blast radius, not raw diff size. The default output is a short score plus a few concrete reasons a PR deserves a deeper human pass.

## Why this matters

Maintainers need a fast way to decide which pull requests deserve a deeper human pass before merge. This project turns that decision into a short score, a short summary, and a few concrete notes.

## What it checks

- large diffs
- package or dependency changes
- missing tests
- rename-heavy changes
- docs-only changes

## Typical output

```text
Codex PR review score: 78/100
Target: /path/to/pr
Risk level: medium
Summary: dependency or lockfile change

- [HIGH] Dependency or lockfile change
  Dependency and lockfile updates deserve closer review because they often alter runtime behavior or supply-chain risk.
```

## Usage

```bash
npm install
node ./bin/codex-pr-reviewer.js review .
```

To review a specific folder or PR checkout:

```bash
node ./bin/codex-pr-reviewer.js review ./path/to/change
```

JSON output:

```bash
node ./bin/codex-pr-reviewer.js review . --json
```

GitHub Actions annotations:

```bash
node ./bin/codex-pr-reviewer.js review . --annotations
```

High-risk findings become `error` annotations, medium-risk findings become `warning`, and low-risk findings become `notice`. When a signal maps to a changed file, the annotation includes its relative path.

Repository-specific tuning:

```json
{
  "$schema": "https://raw.githubusercontent.com/warren2008-2020-spec/codex-pr-reviewer/main/codex-pr-reviewer.schema.json",
  "thresholds": {
    "largeDiffFiles": 40
  }
}
```

Place that in `.codex-pr-reviewer.json` at the repo root to adjust defaults per repository.
The schema enables editor autocomplete, while the CLI rejects unknown keys, invalid ranges, and inconsistent risk thresholds with an actionable error.

Example:

- set `largeDiffFiles` lower for small libraries
- set it higher for generated or documentation-heavy repos
- keep the defaults strict for security-sensitive projects

See [examples/config.example.json](./examples/config.example.json) for a ready-to-copy starting point.

## GitHub integration

Add this workflow to `.github/workflows/codex-pr-review.yml`:

```yaml
name: Codex PR pre-review

on:
  pull_request:

permissions:
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: warren2008-2020-spec/codex-pr-reviewer@v0.2.1
        with:
          path: .
          annotations: 'true'
```

The Action emits native annotations by default. The repository also includes issue templates, a pull request template, and Codex-friendly `AGENTS.md` guidance for maintainer workflows.

## Docs

- [FAQ](./docs/faq.md)
- [Roadmap](./docs/roadmap.md)
