import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const fixturesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function reviewJson(directory, extraArgs = []) {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(process.execPath, ["./bin/codex-pr-reviewer.js", "review", directory, "--json", ...extraArgs], {
      cwd: process.cwd()
    }));
  } catch (error) {
    stdout = error.stdout;
  }

  return JSON.parse(stdout);
}

async function git(directory, ...args) {
  return execFileAsync("git", args, { cwd: directory });
}

test("analyzes only files changed since an explicit Git base", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cpr-base-"));
  await git(directory, "init");
  await git(directory, "config", "user.email", "test@example.com");
  await git(directory, "config", "user.name", "Test User");
  await writeFile(path.join(directory, "README.md"), "# initial\n");
  await writeFile(path.join(directory, "auth.js"), "export const login = () => true;\n");
  await git(directory, "add", ".");
  await git(directory, "commit", "-m", "base");
  const { stdout: baseStdout } = await git(directory, "rev-parse", "HEAD");
  const base = baseStdout.trim();

  await writeFile(path.join(directory, "README.md"), "# updated\n");
  await git(directory, "add", "README.md");
  await git(directory, "commit", "-m", "docs");

  const report = await reviewJson(directory, ["--base", base]);
  assert.deepEqual(report.signals.files, ["README.md"]);
});

test("emits findings for large doc-heavy changes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cpr-docs-"));
  await writeFile(path.join(directory, "README.md"), "# docs\n");
  await writeFile(path.join(directory, "CHANGELOG.md"), "update\n");
  await writeFile(path.join(directory, "docs.md"), "note\n");

  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(process.execPath, ["./bin/codex-pr-reviewer.js", "review", directory], {
      cwd: process.cwd()
    }));
  } catch (error) {
    stdout = error.stdout;
  }

  assert.match(stdout, /Codex PR review score/);
  assert.match(stdout, /docs-only change/i);
});

test("json mode returns review structure", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cpr-json-"));
  await writeFile(path.join(directory, "package.json"), "{}\n");
  await writeFile(path.join(directory, "index.test.js"), "test\n");

  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(process.execPath, ["./bin/codex-pr-reviewer.js", "review", directory, "--json"], {
      cwd: process.cwd()
    }));
  } catch (error) {
    stdout = error.stdout;
  }

  const parsed = JSON.parse(stdout);
  assert.equal(typeof parsed.score, "number");
  assert.ok(Array.isArray(parsed.findings));
  assert.ok(Array.isArray(parsed.summary.reasons));
  assert.match(parsed.summary.text, /dependency|package/i);
});

test("repo config adjusts thresholds", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cpr-config-"));
  await writeFile(path.join(directory, ".codex-pr-reviewer.json"), JSON.stringify({
    thresholds: {
      largeDiffFiles: 2
    }
  }, null, 2));
  await writeFile(path.join(directory, "README.md"), "# docs\n");
  await writeFile(path.join(directory, "CHANGELOG.md"), "update\n");
  await writeFile(path.join(directory, "notes.md"), "note\n");

  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(process.execPath, ["./bin/codex-pr-reviewer.js", "review", directory, "--json"], {
      cwd: process.cwd()
    }));
  } catch (error) {
    stdout = error.stdout;
  }

  const parsed = JSON.parse(stdout);
  assert.ok(parsed.signals.hasLargeDiff);
});

test("rejects invalid repository config with an actionable message", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cpr-invalid-config-"));
  await writeFile(path.join(directory, ".codex-pr-reviewer.json"), JSON.stringify({
    thresholds: {
      largeDiffFiles: 0,
      noisyOption: true
    }
  }));

  await assert.rejects(
    execFileAsync(process.execPath, ["./bin/codex-pr-reviewer.js", "review", directory], {
      cwd: process.cwd()
    }),
    (error) => {
      assert.match(error.stderr, /Invalid \.codex-pr-reviewer\.json/);
      assert.match(error.stderr, /largeDiffFiles must be between 1/);
      return true;
    }
  );
});

test("accepts schema metadata in repository config", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cpr-schema-config-"));
  await writeFile(path.join(directory, ".codex-pr-reviewer.json"), JSON.stringify({
    $schema: "https://raw.githubusercontent.com/warren2008-2020-spec/codex-pr-reviewer/main/codex-pr-reviewer.schema.json",
    thresholds: {
      largeDiffFiles: 5,
      highRiskScore: 90,
      mediumRiskScore: 65
    }
  }));
  await writeFile(path.join(directory, "README.md"), "# fixture\n");

  const report = await reviewJson(directory);
  assert.equal(report.risk, "low");
});

test("emits GitHub Actions annotations with matching file paths", async () => {
  const directory = path.join(fixturesDirectory, "auth-without-tests");

  await assert.rejects(
    execFileAsync(process.execPath, ["./bin/codex-pr-reviewer.js", "review", directory, "--annotations"], {
      cwd: process.cwd()
    }),
    (error) => {
      assert.match(error.stdout, /::error file=src\/auth\/session\.fixture,title=Behavior change without tests::/);
      assert.match(error.stdout, /::error file=src\/auth\/session\.fixture,title=Auth, security, or permission code changed::/);
      return true;
    }
  );
});

test("can report low-severity findings without blocking when configured", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cpr-report-only-"));
  await writeFile(path.join(directory, "README.md"), "# docs\n");

  await assert.doesNotReject(
    execFileAsync(process.execPath, ["./bin/codex-pr-reviewer.js", "review", directory, "--fail-on", "never"], {
      cwd: process.cwd()
    })
  );

  await assert.doesNotReject(
    execFileAsync(process.execPath, ["./bin/codex-pr-reviewer.js", "review", directory, "--fail-on", "high"], {
      cwd: process.cwd()
    })
  );
});

test("composite Action resolves the CLI from its own action path", async () => {
  const actionPath = path.join(process.cwd(), "action.yml");
  const action = await readFile(actionPath, "utf8");

  assert.match(action, /github\.action_path/);
  assert.match(action, /codex-pr-reviewer\.js/);
});

for (const fixture of [
  "auth-without-tests",
  "dependency-update",
  "lockfile-only",
  "database-migration",
  "rename-only"
]) {
  test(`matches the expected risk for ${fixture}`, async () => {
    const directory = path.join(fixturesDirectory, fixture);
    const expected = JSON.parse(await import("node:fs/promises").then(({ readFile }) =>
      readFile(path.join(directory, "expected.json"), "utf8")
    ));
    const report = await reviewJson(directory);

    assert.equal(report.risk, expected.risk);
    assert.deepEqual(report.summary.reasons, expected.reasons);
  });
}
