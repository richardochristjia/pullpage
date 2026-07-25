import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
const missing = process.argv.slice(2).filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  process.exit(1);
}
