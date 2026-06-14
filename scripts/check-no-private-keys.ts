import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ignored = new Set([".git", "node_modules", "dist", "coverage"]);
const secretPattern = /(alpha[_-]?vantage|finnhub|coingecko|polygon).{0,20}[A-Za-z0-9_-]{16,}|SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S{8,}/i;
const allowed = new Set([".env.example", "README.md", "DEPLOYMENT_CHECKLIST.md", "scripts/check-no-private-keys.ts"]);
let failed = false;
function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (stat.size < 1024 * 1024) {
      const relative = path.replace(`${process.cwd()}\\`, "").replaceAll("\\", "/");
      if (allowed.has(relative)) continue;
      const text = readFileSync(path, "utf8");
      if (secretPattern.test(text)) { console.error(`Potential secret found in ${relative}`); failed = true; }
    }
  }
}
walk(process.cwd());
if (failed) process.exit(1);
console.log("No private provider key patterns found in committed source files.");
