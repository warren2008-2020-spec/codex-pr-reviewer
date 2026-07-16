# Changelog

## 0.3.0 - 2026-07-16

- add `--base` to review only files changed since a Git ref or SHA
- add `--fail-on` so teams can report lower-risk findings without blocking merges
- ignore common generated and dependency directories during repository scans
- add `paths.ignoreDirectories` for repository-specific generated folders
- flag changed tests that do not clearly map to changed behavior files

## 0.2.2 - 2026-07-15

- distinguish dependency manifest changes from lockfile-only changes
- keep lockfile-only changes visible as a dedicated supply-chain review signal
- add a lockfile-only regression fixture

## 0.2.1 - 2026-07-14

- fix the composite GitHub Action so it resolves the CLI from the Action's own directory when installed from another repository

## 0.2.0 - 2026-07-13

- prioritize behavior changes without tests and other blast-radius signals
- emit short, ordered review summaries with repository-specific thresholds
- publish a JSON Schema and reject invalid repository configuration
- emit file-aware GitHub Actions annotations
- cover authentication, dependency, migration, and rename-only pull request fixtures

## 0.1.0

- initial PR review CLI
