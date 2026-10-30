import fs from "node:fs";
import path from "node:path";

if (typeof process.loadEnvFile === "function") {
  for (const envPath of [".env", "../.env", "../../.env"]) {
    const resolved = path.resolve(envPath);
    if (fs.existsSync(resolved)) {
      try {
        process.loadEnvFile(resolved);
        break;
      } catch {
        // ignore errors reading .env
      }
    }
  }
}

