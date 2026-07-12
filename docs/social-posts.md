# Social Post Drafts

## GitHub Discussions update

**Title:** Update: blast-radius heuristics and config example added

I just tightened the default review heuristics around blast radius and added a ready-to-copy config example.

Current defaults now prioritize:
- behavior changes without tests
- dependency and lockfile changes
- auth/security/permission code
- database migrations or schema changes
- public API or config changes
- CI or deployment changes

Large diffs still raise risk, but they are no longer treated as a problem by themselves. Rename-heavy changes are discounted unless there is something else going on.

I also added a `.codex-pr-reviewer.json` example so repository-specific thresholds can stay strict where needed and quieter where the repo is documentation-heavy.

If you are using review automation in real repos, what would you tune first: diff thresholds, security sensitivity, or config/API changes?

## DEV draft

**Title:** I shipped a PR pre-review helper that focuses on blast radius, not raw diff size

I published codex-pr-reviewer, a small open-source CLI that helps maintainers pre-review pull requests before merge.

What it does:
- prioritizes behavior changes without tests
- flags dependency and lockfile changes
- treats auth, security, migration, API, config, CI, and deployment changes as higher-signal areas
- keeps rename-only and docs-only changes lower priority
- supports repository-specific thresholds via `.codex-pr-reviewer.json`

Repo: https://github.com/warren2008-2020-spec/codex-pr-reviewer

## X draft

Built codex-pr-reviewer: a small CLI for PR pre-review that prioritizes blast radius over raw diff size. It flags behavior changes without tests, dependency/lockfile updates, security-sensitive code, migrations, API/config changes, and CI/deploy changes. https://github.com/warren2008-2020-spec/codex-pr-reviewer

## Reddit draft

I built codex-pr-reviewer, a small CLI for maintainers who want a fast PR pre-review before merge.

It focuses on blast radius instead of raw diff size:
- behavior changes without tests are the strongest signal
- dependency and lockfile changes are prioritized
- auth/security/permission, migration, API/config, and CI/deployment changes get higher review weight
- rename-only changes are discounted
- thresholds can be tuned per repository

Repo: https://github.com/warren2008-2020-spec/codex-pr-reviewer
