import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkDshLine, dshPeers } from "./dsh-line.mjs";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
for (const f of readdirSync(path.join(root, "lib"))) { if (f.endsWith(".js")) files.push(path.join(root, "lib", f)); }
let failed = 0;
for (const file of files) { const res = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" }); if (res.status !== 0) failed++; }
console.log("checked " + files.length + " file(s), " + failed + " failed");

// THE DSH LINE: the policy and its tests live in scripts/dsh-line.mjs. Here we
// only read the versions this checkout really installed.
const installedVersion = (name) => {
  const file = path.join(root, "node_modules", ...name.split("/"), "package.json");
  if (!existsSync(file)) return undefined;
  try { const version = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")).version; return typeof version === "string" ? version : undefined; } catch { return undefined; }
};
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8").replace(/^\uFEFF/, ""));
const peers = dshPeers(manifest);
const versions = Object.fromEntries(peers.map(([name]) => [name, installedVersion(name)]));
const { failures, line } = checkDshLine(manifest, versions);
for (const failure of failures) { console.log("dsh line: " + failure); failed++; }
if (failures.length === 0 && line.length === 1) console.log("dsh line: " + line[0] + " (" + peers.length + " peer range(s))");

process.exit(failed > 0 ? 1 : 0);
