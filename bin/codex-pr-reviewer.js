#!/usr/bin/env node
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultConfig = {
  thresholds: {
    largeDiffFiles: 25,
    highRiskScore: 85,
    mediumRiskScore: 60
  }
};

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
  const annotations = args.includes("--annotations");
  const config = await loadConfig(target);
  const report = await reviewPullRequest(target, config);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    if (report.findings.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (annotations) {
    for (const finding of report.findings) {
      console.log(formatAnnotation(finding));
    }
  }

  console.log(`Codex PR review score: ${report.score}/100`);
  console.log(`Target: ${target}`);
  console.log(`Risk level: ${report.risk}`);
  console.log(`Summary: ${report.summary.text}`);
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
  codex-pr-reviewer review [path] [--json] [--annotations]

Commands:
  review   Score a pull request diff or repository for review risk.
`);
}

function resolveTarget(args) {
  const targetArg = args.find((arg) => !arg.startsWith("-"));
  return path.resolve(process.cwd(), targetArg ?? ".");
}

async function reviewPullRequest(target, config = defaultConfig) {
  const summary = await summarizeTarget(target, config);
  const findings = [];
  const reasons = [];
  const thresholds = {
    ...defaultConfig.thresholds,
    ...(config.thresholds || {})
  };

  if (summary.hasBehaviorChanges && !summary.hasTests) {
    findings.push({
      severity: "high",
      title: "Behavior change without tests",
      detail: "This is the strongest default signal because it expands blast radius without matching verification.",
      files: matchFiles(summary.files, /src|lib|app|index|server|controller|service|route|handler|api/i)
    });
    reasons.push("behavior change without tests");
  }

  if (summary.touchesDependencyFiles) {
    findings.push({
      severity: "high",
      title: "Dependency or lockfile change",
      detail: "Dependency and lockfile updates deserve closer review because they often alter runtime behavior or supply-chain risk.",
      files: matchFiles(summary.files, /package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|poetry\.lock|pyproject\.toml|Cargo\.toml|go\.mod|go\.sum/i)
    });
    reasons.push("dependency or lockfile change");
  }

  if (summary.touchesSecuritySurface) {
    findings.push({
      severity: "high",
      title: "Auth, security, or permission code changed",
      detail: "Security-sensitive code should always receive a deeper human pass.",
      files: matchFiles(summary.files, /auth|security|permission|acl|role|rbac|oauth|token|secret|sso/i)
    });
    reasons.push("security-sensitive code");
  }

  if (summary.touchesMigrationSurface) {
    findings.push({
      severity: "high",
      title: "Database migration or schema change",
      detail: "Schema changes can be hard to roll back and often need explicit validation.",
      files: matchFiles(summary.files, /migration|schema|ddl|db\/migrate|prisma|typeorm|sequelize|knex/i)
    });
    reasons.push("migration or schema change");
  }

  if (summary.touchesPublicApiOrConfig) {
    findings.push({
      severity: "medium",
      title: "Public API or config change",
      detail: "Public-facing interfaces should be reviewed for compatibility and downstream impact.",
      files: matchFiles(summary.files, /api|public|config|settings|openapi|swagger|schema/i)
    });
    reasons.push("public API or config change");
  }

  if (summary.touchesDeploymentSurface) {
    findings.push({
      severity: "medium",
      title: "CI or deployment change",
      detail: "Changes to CI or deployment behavior can affect how safely the project ships.",
      files: matchFiles(summary.files, /ci|workflow|deploy|release|action|build/i)
    });
    reasons.push("CI or deployment change");
  }

  if (summary.hasLargeDiff) {
    findings.push({
      severity: "low",
      title: "Large diff surface",
      detail: "Large diffs raise risk, but they are not a problem by themselves.",
      files: []
    });
    reasons.push("large diff");
  }

  if (summary.hasRenames && !summary.hasReviewNotes) {
    findings.push({
      severity: "low",
      title: "Rename-heavy change",
      detail: "Rename-only changes are usually discounted after similarity detection unless other signals are present.",
      files: matchFiles(summary.files, /rename|moved/i)
    });
    reasons.push("rename-heavy change");
  }

  if (summary.touchesDocsOnly) {
    findings.push({
      severity: "low",
      title: "Docs-only change",
      detail: "Docs changes are low risk, but links and examples should still be checked.",
      files: summary.files
    });
    reasons.push("docs-only change");
  }

  const score = Math.max(0, 100 - findings.reduce((total, item) => {
    if (item.severity === "high") return total + 22;
    if (item.severity === "medium") return total + 10;
    return total + 4;
  }, 0));
  const summaryText = reasons.length > 0 ? reasons.slice(0, 3).join(", ") : "no immediate review blockers";

  return {
    score,
    risk: score >= thresholds.highRiskScore ? "low" : score >= thresholds.mediumRiskScore ? "medium" : "high",
    summary: {
      text: summaryText,
      reasons
    },
    target,
    signals: summary,
    findings
  };
}

async function summarizeTarget(target, config = defaultConfig) {
  const files = await listFiles(target);
  const joined = files.join("\n");
  const thresholds = {
    ...defaultConfig.thresholds,
    ...(config.thresholds || {})
  };

  return {
    files,
    fileCount: files.length,
    hasLargeDiff: files.length >= thresholds.largeDiffFiles,
    hasBehaviorChanges: /src|lib|app|index|server|controller|service|route|handler|api/i.test(joined),
    touchesDependencyFiles: /package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|poetry\.lock|pyproject\.toml|Cargo\.toml|go\.mod|go\.sum/i.test(joined),
    hasTests: /test|tests|__tests__|spec/.test(joined),
    touchesDocsOnly: files.length > 0 && files.every((file) => /\.(md|txt|adoc|rst|yml|yaml)$/.test(file)),
    hasRenames: /rename|moved/i.test(joined),
    hasReviewNotes: /review notes|review-note|rationale/i.test(joined),
    touchesSecuritySurface: /auth|security|permission|permission|acl|role|rbac|oauth|token|secret|sso/i.test(joined),
    touchesMigrationSurface: /migration|schema|ddl|db\/migrate|prisma|typeorm|sequelize|knex/i.test(joined),
    touchesPublicApiOrConfig: /api|public|config|settings|openapi|swagger|schema/i.test(joined),
    touchesDeploymentSurface: /ci|workflow|deploy|release|action|build/i.test(joined)
  };
}

function matchFiles(files, pattern) {
  return files.filter((file) => pattern.test(file));
}

function formatAnnotation(finding) {
  const level = finding.severity === "high" ? "error" : finding.severity === "medium" ? "warning" : "notice";
  const properties = [`title=${escapeWorkflowValue(finding.title)}`];
  if (finding.files[0]) properties.unshift(`file=${escapeWorkflowValue(finding.files[0].replaceAll("\\", "/"))}`);
  return `::${level} ${properties.join(",")}::${escapeWorkflowValue(finding.detail)}`;
}

function escapeWorkflowValue(value) {
  return String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

async function loadConfig(target) {
  const configPath = path.join(target, ".codex-pr-reviewer.json");
  if (!existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    validateConfig(parsed);
    return {
      thresholds: {
        ...defaultConfig.thresholds,
        ...(parsed.thresholds || {})
      }
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid .codex-pr-reviewer.json: ${detail}`);
  }
}

function validateConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("configuration must be a JSON object");
  }

  const allowedRootKeys = new Set(["$schema", "thresholds"]);
  const unknownRootKey = Object.keys(config).find((key) => !allowedRootKeys.has(key));
  if (unknownRootKey) {
    throw new Error(`unknown property: ${unknownRootKey}`);
  }

  if (config.thresholds === undefined) return;
  if (!config.thresholds || typeof config.thresholds !== "object" || Array.isArray(config.thresholds)) {
    throw new Error("thresholds must be a JSON object");
  }

  const rules = {
    largeDiffFiles: { minimum: 1, maximum: Number.MAX_SAFE_INTEGER, integer: true },
    highRiskScore: { minimum: 0, maximum: 100 },
    mediumRiskScore: { minimum: 0, maximum: 100 }
  };

  for (const [key, value] of Object.entries(config.thresholds)) {
    const rule = rules[key];
    if (!rule) throw new Error(`unknown threshold: ${key}`);
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${key} must be a number`);
    }
    if (rule.integer && !Number.isInteger(value)) {
      throw new Error(`${key} must be an integer`);
    }
    if (value < rule.minimum || value > rule.maximum) {
      throw new Error(`${key} must be between ${rule.minimum} and ${rule.maximum}`);
    }
  }

  const thresholds = { ...defaultConfig.thresholds, ...config.thresholds };
  if (thresholds.highRiskScore <= thresholds.mediumRiskScore) {
    throw new Error("highRiskScore must be greater than mediumRiskScore");
  }
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
