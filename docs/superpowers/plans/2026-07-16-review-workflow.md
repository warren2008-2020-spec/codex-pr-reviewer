# Review Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `codex-pr-reviewer` analyze a real PR diff, support configurable gating, and emit focused evidence signals.

**Architecture:** Keep the single CLI module. Add argument parsing and git change collection before summary construction, then derive findings from the resulting file set. Keep config validation local to the existing config path.

**Tech Stack:** Node.js 20+, node:test, GitHub composite Action.

## Global Constraints

- Preserve current repository-scan behavior when no base ref is supplied.
- Do not claim filename matching is coverage analysis.
- Keep the default CLI failure behavior backward-compatible.

---

### Task 1: Analyze an explicit Git base

**Files:**
- Modify: `bin/codex-pr-reviewer.js`
- Modify: `test/review.test.js`

- [ ] Write a temporary Git repository test with an unchanged auth file, a changed README, and `--base <base-sha>`; expect only the README in `signals.files`.
- [ ] Run `npm test` and confirm the new test fails because the CLI scans the whole repository.
- [ ] Add `--base` argument parsing and `git diff --name-only <base>...HEAD` collection with a repository-scan fallback.
- [ ] Run `npm test` and confirm all tests pass.

### Task 2: Configure blocking separately from reporting

**Files:**
- Modify: `bin/codex-pr-reviewer.js`
- Modify: `action.yml`
- Modify: `test/review.test.js`
- Modify: `examples/github-action.yml`
- Modify: `README.md`

- [ ] Write CLI tests for `--fail-on never` and `--fail-on high` against a low-severity finding.
- [ ] Confirm both tests fail with the current unconditional nonzero exit.
- [ ] Add severity-based exit policy and Action inputs for `base` and `fail-on`.
- [ ] Use `fetch-depth: 0`, GitHub event base SHA, and `fail-on: high` in the example workflow.
- [ ] Run `npm test` and confirm all tests pass.

### Task 3: Add conservative test-evidence and generated-file signals

**Files:**
- Modify: `bin/codex-pr-reviewer.js`
- Modify: `test/review.test.js`
- Create: `test/fixtures/test-mismatch/expected.json`
- Create: `test/fixtures/test-mismatch/src/payment/refund.js`
- Create: `test/fixtures/test-mismatch/test/login.test.js`

- [ ] Write a fixture expectation for a low-severity test-evidence mismatch finding, then confirm it fails.
- [ ] Add normalized source/test module matching and an explicitly cautious finding message.
- [ ] Write a temporary directory test showing generated directories do not contribute to file count or risk.
- [ ] Add default directory exclusions and `paths.ignoreDirectories` config validation.
- [ ] Run `npm test` and confirm all tests pass.

### Task 4: Document and release

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `codex-pr-reviewer.schema.json`

- [ ] Document diff mode, failure policy, test-evidence limits, and directory exclusions.
- [ ] Add schema support for `paths.ignoreDirectories`.
- [ ] Run `npm test`, `npm pack --dry-run --json`, and a fresh `npx` smoke check.
- [ ] Commit the finished work, merge to `main`, tag a new release, and publish the npm package.
