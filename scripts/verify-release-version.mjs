import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

const packageVersion = readJson('package.json').version;
const claudeVersion = readJson('plugins/sekit-grc/.claude-plugin/plugin.json').version;
const codexVersion = readJson('plugins/sekit-grc/.codex-plugin/plugin.json').version;

assert.equal(claudeVersion, packageVersion, 'Claude manifest version must match package.json');
assert.equal(codexVersion, packageVersion, 'OpenAI manifest version must match package.json');

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (tag) {
  assert.match(tag, /^v\d+\.\d+\.\d+$/, 'release tag must use vX.Y.Z');
  assert.equal(tag.slice(1), packageVersion, 'release tag must match all manifest versions');
  console.log(`Release ${tag} matches every manifest.`);
} else {
  console.log(`All manifests use version ${packageVersion}.`);
}
