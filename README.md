# codex-pr-reviewer

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

Repository-specific tuning:

```json
{
  "thresholds": {
    "largeDiffFiles": 40
  }
}
```

Place that in `.codex-pr-reviewer.json` at the repo root to adjust defaults per repository.

Example:

- set `largeDiffFiles` lower for small libraries
- set it higher for generated or documentation-heavy repos
- keep the defaults strict for security-sensitive projects

See [examples/config.example.json](./examples/config.example.json) for a ready-to-copy starting point.

## GitHub integration

The repository is designed to support maintainer workflows with:

- a composite GitHub Action wrapper
- issue templates
- a pull request template
- Codex-friendly `AGENTS.md` guidance
  - this keeps the repository easy to adopt in real maintainer workflows

## Docs

- [FAQ](./docs/faq.md)
- [Roadmap](./docs/roadmap.md)
