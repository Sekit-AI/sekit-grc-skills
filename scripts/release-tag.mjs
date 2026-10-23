import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Tags origin/main with the version every manifest declares and pushes only
// that tag. Reads manifests from the commit itself, not the working tree, so a
// stale or dirty checkout cannot produce a mismatched tag.
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const readJsonAt = (sha, path) => JSON.parse(git('show', `${sha}:${path}`));

git('fetch', 'origin', '--quiet');
const sha = git('rev-parse', 'origin/main');

const packageVersion = readJsonAt(sha, 'package.json').version;
const claudeVersion = readJsonAt(sha, 'plugins/sekit-grc/.claude-plugin/plugin.json').version;
const codexVersion = readJsonAt(sha, 'plugins/sekit-grc/.codex-plugin/plugin.json').version;

assert.equal(claudeVersion, packageVersion, 'Claude manifest version must match package.json');
assert.equal(codexVersion, packageVersion, 'OpenAI manifest version must match package.json');

const tag = `v${packageVersion}`;
assert.match(tag, /^v\d+\.\d+\.\d+$/, 'release tag must use vX.Y.Z');
assert.equal(git('tag', '--list', tag), '', `tag ${tag} already exists locally`);
assert.equal(git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`), '', `tag ${tag} already exists on origin`);

git('tag', '-a', tag, sha, '-m', tag);
execFileSync('git', ['push', 'origin', `refs/tags/${tag}`], { stdio: 'inherit' });
console.log(`Pushed ${tag} -> ${sha}`);
