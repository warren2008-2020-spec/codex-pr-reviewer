# Review Workflow Design

## Goal

Make the reviewer useful in real pull-request workflows without claiming it can prove test coverage.

## Decisions

1. The CLI accepts `--base <git-ref>` and, when supplied, analyzes only files changed in `<git-ref>...HEAD`. When no base is available, it retains the current repository scan and reports that fallback mode in JSON.
2. The CLI accepts `--fail-on <high|medium|low|never>`. The default remains `low` for compatibility; the documented Action workflow uses `high` so teams can begin with annotations before turning every finding into a gate.
3. When changed behavior files and test files are both present but their normalized module names do not overlap, the reviewer emits a low-severity `Test evidence may not match changed behavior` finding. It is an evidence prompt, not a coverage assertion.
4. Known generated and dependency directories are ignored while collecting files: `.git`, `node_modules`, `dist`, `build`, `coverage`, `.next`, `vendor`, `target`, and `__pycache__`. Repository config can add ignore directory names under `paths.ignoreDirectories`.

## Non-goals

- Parsing every language's imports or calculating line coverage.
- Posting pull-request comments or mutating repositories.
- Treating test filename heuristics as proof of behavioral coverage.
