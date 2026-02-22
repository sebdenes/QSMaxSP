#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const prismaDir = path.join(projectRoot, "prisma");
const testDbPath = path.join(prismaDir, "test.db");

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function runPrisma(args, env) {
  const prismaBin = path.join(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma"
  );
  run(prismaBin, args, env);
}

function runTests(env) {
  run("node", ["--import", "tsx", "--test", "tests/**/*.integration.test.ts"], env);
}

function main() {
  fs.mkdirSync(prismaDir, { recursive: true });
  if (fs.existsSync(testDbPath)) {
    fs.rmSync(testDbPath, { force: true });
  }

  const env = {
    ...process.env,
    DATABASE_URL: "file:./test.db",
    RUN_INTEGRATION_TESTS: "1",
    AUTH_DISABLED: "false",
    NEXT_PUBLIC_AUTH_DISABLED: "false",
    ALLOW_SELF_SIGNUP: "false",
    ALLOW_DEMO_LOGIN: "false",
    RUST_LOG: process.env.RUST_LOG ?? "trace"
  };

  runPrisma(["generate"], env);
  runPrisma(["db", "push", "--skip-generate"], env);
  run("node", ["--import", "tsx", "prisma/seed.ts"], env);
  runTests(env);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[test:integration] Failed: ${message}`);
  process.exit(1);
}
