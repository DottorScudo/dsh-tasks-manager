// The DSH peer line. Version 0.7.0 pinned dsh-system-prompt/dsh-tools to the
// exact version 0.2.0-rc.2; DSH compares those peers with the RUNNING runtime
// and refused the plugin on 0.2.1-rc.2 even though the code was unchanged. So
// these pins keep the policy honest: peers are ranges that cover the installed
// major.minor line, and the bug that shipped in 0.7.0 cannot come back silently.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DSH_PACKAGE, checkDshLine, dshPeers } from '../scripts/dsh-line.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** A two-peer manifest shaped like this package's own. */
const peersManifest = (systemPrompt, tools) => ({
  peerDependencies: { '@deepseek-ai/cordis': '^4.0.4', '@deepseek-ai/dsh-system-prompt': systemPrompt, '@deepseek-ai/dsh-tools': tools },
});

describe('dshPeers', () => {
  it('keeps the @deepseek-ai/dsh and dsh-* peers only', () => {
    assert.deepEqual(dshPeers(peersManifest('^0.2.0-rc.2', '^0.2.0-rc.2')).map(([name]) => name), [
      '@deepseek-ai/dsh-system-prompt',
      '@deepseek-ai/dsh-tools',
    ]);
    assert.equal(DSH_PACKAGE.test('@deepseek-ai/cordis'), false);
    assert.equal(DSH_PACKAGE.test('@deepseek-ai/dsh'), true);
  });
});

describe('checkDshLine', () => {
  const versions = { '@deepseek-ai/dsh-system-prompt': '0.2.1-rc.2', '@deepseek-ai/dsh-tools': '0.2.1-rc.2' };

  it('accepts a range that covers the installed line', () => {
    const { failures, line } = checkDshLine(peersManifest('^0.2.0-rc.2', '^0.2.0-rc.2'), versions);
    assert.deepEqual(failures, []);
    assert.deepEqual(line, ['0.2.1-rc.2']);
  });

  it('rejects the exact pin that refused DSH 0.2.1-rc.2', () => {
    const { failures } = checkDshLine(peersManifest('0.2.0-rc.2', '0.2.0-rc.2'), { '@deepseek-ai/dsh-system-prompt': '0.2.0-rc.2', '@deepseek-ai/dsh-tools': '0.2.0-rc.2' });
    assert.equal(failures.length, 2);
    assert.match(failures[0], /pins one exact version/);
  });

  it('rejects a range that does not cover the installed runtime', () => {
    const { failures } = checkDshLine(peersManifest('^0.1.7-rc.2', '^0.1.7-rc.2'), versions);
    assert.equal(failures.length, 2);
    assert.match(failures[0], /does not cover the installed 0\.2\.1-rc\.2/);
  });

  it('rejects a malformed range and a peer that is not installed', () => {
    assert.match(checkDshLine(peersManifest('', 'not a range'), versions).failures[0], /must declare a semver range/);
    assert.match(checkDshLine(peersManifest('^0.2.0-rc.2', '^0.2.0-rc.2'), {}).failures[0], /not installed/);
  });

  it('rejects a manifest without DSH peers', () => {
    const { failures } = checkDshLine({ peerDependencies: { '@deepseek-ai/cordis': '^4.0.4' } }, versions);
    assert.deepEqual(failures, ['package.json declares no @deepseek-ai/dsh* peer']);
  });

  it('rejects installed peers that disagree with one another', () => {
    const { failures } = checkDshLine(peersManifest('^0.2.0-rc.2', '^0.2.0-rc.2'), { '@deepseek-ai/dsh-system-prompt': '0.2.0-rc.2', '@deepseek-ai/dsh-tools': '0.2.1-rc.2' });
    assert.match(failures.join('\n'), /packages disagree \(0\.2\.0-rc\.2, 0\.2\.1-rc\.2\)/);
  });
});

describe('this package declares the compatible line', () => {
  it('covers DSH 0.2.1-rc.2, the release that refused 0.7.0', () => {
    const installed = Object.fromEntries(dshPeers(manifest).map(([name]) => [name, '0.2.1-rc.2']));
    assert.deepEqual(checkDshLine(manifest, installed).failures, []);
  });

  it('does not claim the next minor line', () => {
    const installed = Object.fromEntries(dshPeers(manifest).map(([name]) => [name, '0.3.0-rc.1']));
    assert.match(checkDshLine(manifest, installed).failures.join('\n'), /does not cover the installed 0\.3\.0-rc\.1/);
  });
});
