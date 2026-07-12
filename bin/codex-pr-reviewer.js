#!/usr/bin/env node
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const commands = new Map([
  ["review", runReview],
  ["help", runHelp],
  ["--help", runHelp],
  ["-h", runHelp]
]);

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  const handler = commands.get(command);

  if (!handler) {
    console.error(`Unknown command: ${command}`);
    runHelp();
    process.exitCode = 1;
    return;
  }

  await handler(args);
}

async function runReview(args = []) {
  const target = resolveTarget(args);
  const json = args.includes("--json");
  const report = await reviewPullRequest(target);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    if (report.findings.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  console.log(`Codex PR review score: ${report.score}/100`);
  console.log(`Target: ${target}`);
  console.log(`Risk level: ${report.risk}`);
  console.log("");

  if (report.findings.length === 0) {
    console.log("No immediate review blockers found.");
    return;
  }

  for (const finding of report.findings) {
    console.log(`- [${finding.severity.toUpperCase()}] ${finding.title}`);
    console.log(`  ${finding.detail}`);
  }

  process.exitCode = 1;
}

function runHelp() {
  console.log(`codex-pr-reviewer

Usage:
  codex-pr-reviewer review [path] [--json]

Commands:
  review   Score a pull request diff or repository for review risk.
`);
}

function resolveTarget(args) {
  const targetArg = args.find((arg) => !arg.startsWith("-"));
  return path.resolve(process.cwd(), targetArg ?? ".");
}

async function reviewPullRequest(target) {
  const summary = await summarizeTarget(target);
  const findings = [];

  if (summary.hasLargeDiff) {
    findings.push({
      severity: "high",
      title: "Large diff surface",
      detail: "Review this change in smaller slices. Big diffs tend to hide regressions and missing tests."
    });
  }

  if (summary.touchesPackageFiles && !summary.hasTests) {
    findings.push({
      severity: "high",
      title: "Package files changed without tests",
      detail: "A package or dependency change should usually ship with at least one test or verification step."
    });
  }

  if (summary.touchesDocsOnly) {
    findings.push({
      severity: "low",
      title: "Docs-only change",
      detail: "This is low risk, but still check that examples and links stay accurate."
    });
  }

  if (summary.hasRenames && !summary.hasReviewNotes) {
    findings.push({
      severity: "medium",
      title: "Rename-heavy change",
      detail: "Renames often need explicit review notes so maintainers can verify the intent."
    });
  }

  const score = Math.max(0, 100 - findings.reduce((total, item) => {
    if (item.severity === "high") return total + 25;
    if (item.severity === "medium") return total + 12;
    return total + 5;
  }, 0));

  return {
    score,
    risk: score >= 85 ? "low" : score >= 60 ? "medium" : "high",
    target,
    summary,
    findings
  };
}

async function summarizeTarget(target) {
  const files = await listFiles(target);
  const joined = files.join("\n");

  return {
    fileCount: files.length,
    hasLargeDiff: files.length >= 25,
    touchesPackageFiles: /package\.json|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod/.test(joined),
    hasTests: /test|tests|__tests__|spec/.test(joined),
    touchesDocsOnly: files.length > 0 && files.every((file) => /\.(md|txt|adoc|rst|yml|yaml)$/.test(file)),
    hasRenames: /rename|moved/i.test(joined),
    hasReviewNotes: /review notes|review-note|rationale/i.test(joined)
  };
}

async function listFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = await readdir(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      const nested = await listFiles(fullPath);
      files.push(...nested.map((item) => path.join(entry, item)));
    } else {
      files.push(entry);
    }
  }

  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
