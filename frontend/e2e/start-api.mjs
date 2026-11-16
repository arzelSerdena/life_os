// Starts the API for the browser tests on a fresh, throwaway database, so a test run
// never touches real data or the dev servers on 8000 and 5173.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const port = process.argv[2] ?? "8100";
const backend = resolve(import.meta.dirname, "../../backend");
const dataDir = join(tmpdir(), "life-os-e2e");
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

const env = {
  ...process.env,
  LIFE_OS_DATABASE_URL: `sqlite:///${join(dataDir, "e2e.db").replaceAll("\\", "/")}`,
};

const migrate = spawnSync("uv", ["run", "alembic", "upgrade", "head"], {
  cwd: backend,
  env,
  stdio: "inherit",
});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const api = spawn("uv", ["run", "uvicorn", "app.main:app", "--port", port], {
  cwd: backend,
  env,
  stdio: "inherit",
});
api.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => api.kill(signal));
