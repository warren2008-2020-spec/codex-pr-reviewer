# FAQ

## What does codex-pr-reviewer check first?

The CLI focuses on signals that usually change review effort: large diffs, dependency changes, missing tests, rename-heavy changes, and docs-only changes.

## Why is the score simple?

The goal is to help maintainers decide when a PR needs a deeper human pass. A small score and a short list of findings are easier to scan than a long explanation.

## Should docs-only changes be ignored?

No. They are lower risk, but link checks and example accuracy still matter.

## What should be treated as a blocker?

Anything that makes the change hard to verify quickly: big diffs, package changes without tests, or changes that need additional review notes.
