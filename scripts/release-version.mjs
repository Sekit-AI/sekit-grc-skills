import assert from 'node:assert/strict';

// Shared release rules for verify-release-version.mjs and release-tag.mjs.
// `readJson` reads a repository path, from the working tree or from a commit.
export function assertManifestVersions(readJson) {
  const packageVersion = readJson('package.json').version;
  const claudeVersion = readJson('plugins/sekit-grc/.claude-plugin/plugin.json').version;
  const codexVersion = readJson('plugins/sekit-grc/.codex-plugin/plugin.json').version;

  assert.equal(claudeVersion, packageVersion, 'Claude manifest version must match package.json');
  assert.equal(codexVersion, packageVersion, 'OpenAI manifest version must match package.json');
  return packageVersion;
}

export function assertReleaseTag(tag, version) {
  assert.match(tag, /^v\d+\.\d+\.\d+$/, 'release tag must use vX.Y.Z');
  assert.equal(tag.slice(1), version, 'release tag must match all manifest versions');
}
