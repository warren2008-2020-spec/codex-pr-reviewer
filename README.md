# codex-pr-reviewer

[![CI](https://github.com/warren2008-2020-spec/codex-pr-reviewer/actions/workflows/ci.yml/badge.svg)](https://github.com/warren2008-2020-spec/codex-pr-reviewer/actions/workflows/ci.yml)

`codex-pr-reviewer` is a small CLI for maintainers who want a fast, opinionated PR pre-review before merge.

It focuses on blast radius, not raw diff size. The default output is a short score plus a few concrete reasons a PR deserves a deeper human pass.

## Why this matters

Maintainers need a fast way to decide which pull requests deserve a deeper human pass before merge. This project turns that decision into a short score, a short summary, and a few concrete notes.

## What it checks

- large diffs
- files changed since a Git base ref
- dependency manifest changes
- lockfile-only changes
- behavior changes without tests
- test changes that may not match changed behavior
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

Run it without cloning the repository:

```bash
npx --yes codex-pr-reviewer@v0 review .
```

Or install the CLI globally:

```bash
npm install --global codex-pr-reviewer@v0
codex-pr-reviewer review .
```

To review a specific folder or PR checkout:

```bash
npx --yes codex-pr-reviewer@v0 review ./path/to/change
```

For local development from a clone:

```bash
npm install
node ./bin/codex-pr-reviewer.js review .
```

JSON output:

```bash
npx --yes codex-pr-reviewer@v0 review . --json
```

GitHub Actions annotations:

```bash
npx --yes codex-pr-reviewer@v0 review . --annotations
```

High-risk findings become `error` annotations, medium-risk findings become `warning`, and low-risk findings become `notice`. When a signal maps to a changed file, the annotation includes its relative path.

Review only files changed since a Git base ref:

```bash
npx --yes codex-pr-reviewer@v0 review . --base origin/main
```

Control whether findings block the command:

```bash
npx --yes codex-pr-reviewer@v0 review . --fail-on high
npx --yes codex-pr-reviewer@v0 review . --fail-on never
```

`--fail-on` accepts `high`, `medium`, `low`, or `never`. The CLI default is `low` for strict local checks. In shared CI, `high` is often a better first setting because low and medium findings still appear in the report without blocking every pull request.

Repository-specific tuning:

```json
{
  "$schema": "https://raw.githubusercontent.com/warren2008-2020-spec/codex-pr-reviewer/main/codex-pr-reviewer.schema.json",
  "thresholds": {
    "largeDiffFiles": 40
  },
  "paths": {
    "ignoreDirectories": ["generated-output"]
  }
}
```

Place that in `.codex-pr-reviewer.json` at the repo root to adjust defaults per repository.
The schema enables editor autocomplete, while the CLI rejects unknown keys, invalid ranges, and inconsistent risk thresholds with an actionable error.

Example:

- set `largeDiffFiles` lower for small libraries
- set it higher for generated or documentation-heavy repos
- add generated folders to `paths.ignoreDirectories`
- keep the defaults strict for security-sensitive projects

See [examples/config.example.json](./examples/config.example.json) for a ready-to-copy starting point.

## GitHub integration

Copy [`examples/github-action.yml`](./examples/github-action.yml) to `.github/workflows/codex-pr-review.yml`, or start with this workflow:

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
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Pre-review pull request risk
        uses: warren2008-2020-spec/codex-pr-reviewer@v0
        with:
          path: .
          base: ${{ github.event.pull_request.base.sha }}
          fail-on: high
          annotations: 'true'
```

The `v0` tag tracks compatible updates. Pin `v0.3.0` when a workflow needs an exact release. The Action emits native annotations by default. The repository also includes issue templates, a pull request template, and Codex-friendly `AGENTS.md` guidance for maintainer workflows.

The Action is intentionally thin: the CLI does the analysis, while the workflow controls checkout depth, base comparison, annotations, and merge-blocking policy.

## Docs

- [FAQ](./docs/faq.md)
- [Roadmap](./docs/roadmap.md)
