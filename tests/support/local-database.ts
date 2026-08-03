const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export function requireDisposableLocalDatabaseUrl(databaseUrl: string | undefined, variableName: string) {
  try {
    const url = new URL(databaseUrl ?? "");
    if (url.protocol === "postgresql:" && LOOPBACK_HOSTS.has(url.hostname)) return databaseUrl!;
  } catch {
    // Fall through to the safety error below.
  }

  throw new Error(`${variableName} must identify a disposable loopback PostgreSQL database`);
}
