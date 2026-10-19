// THE DSH LINE. DSH gates a plugin on the `@deepseek-ai/dsh*` peers it declares:
// `evaluatePluginCompatibility` (@deepseek-ai/dsh-app-boot) compares every such
// range against the version of the RUNNING runtime, and refuses the install (or
// denies the mounted bundle at boot) when a range does not cover it.
//
// An exact pin is therefore a refusal on the next DSH release, not a warning:
// version 0.7.0 pinned dsh-system-prompt/dsh-tools to 0.2.0-rc.2 and DSH
// 0.2.1-rc.2 refused the plugin although the code did not change. So every DSH
// peer is a semver RANGE that must cover the line really installed here, never
// one exact version, and the installed packages must agree with one another
// (DSH ships every @deepseek-ai/dsh* package at the runtime version).
//
// Pure so the policy is testable: the caller supplies the installed versions.
import semver from "semver";

/** One DSH package name (`@deepseek-ai/dsh` or any `@deepseek-ai/dsh-*`). */
export const DSH_PACKAGE = /^@deepseek-ai\/dsh(?:-.*)?$/;

/** The DSH peers a manifest declares, as `[name, range]` pairs. */
export function dshPeers(manifest) {
  return Object.entries(manifest?.peerDependencies ?? {}).filter(([name]) => DSH_PACKAGE.test(name));
}

/**
 * Validate the DSH peer line against the versions installed in node_modules.
 * @param manifest Parsed package.json of this plugin.
 * @param versions Installed version per DSH package name (missing packages absent).
 * @returns `failures` for the caller to print, and the `line` versions found.
 */
export function checkDshLine(manifest, versions) {
  const failures = [];
  const peers = dshPeers(manifest);
  if (peers.length === 0) {
    failures.push("package.json declares no @deepseek-ai/dsh* peer");
    return { failures, line: [] };
  }
  const line = new Set();
  for (const [name, range] of peers) {
    // An exact version passes `satisfies` today and refuses the next release.
    if (typeof range !== "string" || semver.validRange(range, { includePrerelease: true }) === null) {
      failures.push(name + " must declare a semver range, found " + JSON.stringify(range));
      continue;
    }
    if (semver.valid(range) !== null) {
      failures.push(name + " pins one exact version (" + range + "); declare a range that covers the installed line");
      continue;
    }
    const installed = versions[name];
    if (typeof installed !== "string" || installed === "") {
      failures.push(name + "@" + range + " is not installed in node_modules — run pnpm install");
      continue;
    }
    line.add(installed);
    if (!semver.satisfies(installed, range, { includePrerelease: true })) {
      failures.push(name + " range " + range + " does not cover the installed " + installed + " — widen the peer");
    }
  }
  if (line.size > 1) failures.push("the installed @deepseek-ai/dsh* packages disagree (" + [...line].sort().join(", ") + ")");
  return { failures, line: [...line].sort() };
}
