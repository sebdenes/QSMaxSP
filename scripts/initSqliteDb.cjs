#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const schemaDirectory = path.join(projectRoot, "prisma");

function parseArgs(argv) {
  const args = {
    reset: false,
    dbFile: null,
    dbUrl: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--reset") {
      args.reset = true;
      continue;
    }

    if (token === "--db-file") {
      args.dbFile = argv[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (token === "--db-url") {
      args.dbUrl = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
  }

  return args;
}

function toAbsolutePath(inputPath) {
  if (!inputPath) {
    return null;
  }

  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  return path.resolve(projectRoot, inputPath);
}

function toPrismaPath(filePath) {
  const relativePath = path.relative(schemaDirectory, filePath);
  const normalized = relativePath.split(path.sep).join("/");

  if (!normalized.startsWith(".")) {
    return `./${normalized}`;
  }

  return normalized;
}

function toDatabaseUrl(args) {
  if (args.dbUrl) {
    return args.dbUrl;
  }

  if (args.dbFile) {
    const absoluteDbPath = toAbsolutePath(args.dbFile);
    return `file:${toPrismaPath(absoluteDbPath)}`;
  }

  const envDbUrl = (process.env.DATABASE_URL ?? "").trim();
  if (envDbUrl) {
    return envDbUrl;
  }

  return "file:./dev.db";
}

function resolveDatabasePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const raw = databaseUrl.slice("file:".length);
  if (!raw) {
    return null;
  }

  if (raw.startsWith("./") || raw.startsWith("../")) {
    return path.resolve(schemaDirectory, raw);
  }

  if (/^[A-Za-z]:[\\/]/.test(raw)) {
    return raw;
  }

  if (path.isAbsolute(raw)) {
    return raw;
  }

  return path.resolve(schemaDirectory, raw);
}

function runCommand(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function runNodeBinary(binName, args, env) {
  const binPath = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? `${binName}.cmd` : binName);
  runCommand(binPath, args, env);
}

function ensureDirectory(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

function sleepMs(durationMs) {
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    // Intentional blocking wait for retry backoff in CLI setup script.
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = toDatabaseUrl(args);
  const databasePath = resolveDatabasePath(databaseUrl);

  if (databasePath && args.reset && fs.existsSync(databasePath)) {
    fs.rmSync(databasePath, { force: true });
  }

  if (databasePath) {
    ensureDirectory(databasePath);
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    AUTH_DISABLED: process.env.AUTH_DISABLED ?? "true",
    NEXT_PUBLIC_AUTH_DISABLED: process.env.NEXT_PUBLIC_AUTH_DISABLED ?? "true",
    ALLOW_SELF_SIGNUP: process.env.ALLOW_SELF_SIGNUP ?? "false",
    ALLOW_DEMO_LOGIN: process.env.ALLOW_DEMO_LOGIN ?? "false"
  };

  console.log(`[db:init] DATABASE_URL=${databaseUrl}`);
  runNodeBinary("prisma", ["generate"], env);

  const pushEnv = {
    ...env,
    RUST_LOG: env.RUST_LOG ?? "trace"
  };

  let pushError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      runNodeBinary("prisma", ["db", "push", "--skip-generate"], pushEnv);
      pushError = null;
      break;
    } catch (error) {
      pushError = error;
      if (attempt < 3) {
        if (databasePath && fs.existsSync(databasePath)) {
          fs.rmSync(databasePath, { force: true });
        }

        const journalPath = `${databasePath ?? ""}-journal`;
        if (databasePath && fs.existsSync(journalPath)) {
          fs.rmSync(journalPath, { force: true });
        }

        sleepMs(1200);
      }
    }
  }

  if (pushError) {
    process.exit(1);
  }

  runCommand("node", ["--import", "tsx", "prisma/seed.ts"], env);
  console.log("[db:init] Database schema and seed are ready.");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[db:init] Failed: ${message}`);
  process.exit(1);
}
