import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

  const { stdout } = await execFileAsync(process.execPath, ["./bin/codex-pr-reviewer.js", "review", directory, "--json"], {
    cwd: process.cwd()
  });

  const parsed = JSON.parse(stdout);
  assert.equal(typeof parsed.score, "number");
  assert.ok(Array.isArray(parsed.findings));
  assert.equal(parsed.summary.touchesPackageFiles, true);
});
