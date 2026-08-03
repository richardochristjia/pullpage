import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is required to run production validation");

const environment = { ...process.env, VERCEL_ENV: "production" };
const commands = [
  [npmCli, "run", "build"],
  [fileURLToPath(import.meta.resolve("@playwright/test/cli")), "test", "tests/e2e/catalog-smoke.spec.ts"],
];

for (const arguments_ of commands) {
  const result = spawnSync(process.execPath, arguments_, {
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
