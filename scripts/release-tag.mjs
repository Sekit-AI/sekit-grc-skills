import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { assertManifestVersions, assertReleaseTag } from './release-version.mjs';

// Tags origin/main with the version every manifest declares and pushes only
// that tag. Reads manifests from the commit itself, not the working tree, so a
// stale or dirty checkout cannot produce a mismatched tag.
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const readJsonAt = (sha) => (path) => JSON.parse(git('show', `${sha}:${path}`));

git('fetch', 'origin', '--quiet');
const sha = git('rev-parse', 'origin/main');
const readJson = readJsonAt(sha);

// A fork checkout would tag and push the fork, not the canonical repository.
const canonical = readJson('package.json').repository.url.match(/github\.com[/:](.+?)(?:\.git)?$/)[1];
const originRepo = git('remote', 'get-url', 'origin').match(/github\.com[/:](.+?)(?:\.git)?$/)?.[1];
assert.equal(originRepo, canonical, `origin must point to ${canonical}`);

const version = assertManifestVersions(readJson);
const tag = `v${version}`;
assertReleaseTag(tag, version);
assert.equal(git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`), '', `tag ${tag} already exists on origin`);
assert.equal(git('tag', '--list', tag), '', `stale local tag ${tag}; remove it with \`git tag -d ${tag}\``);

git('tag', '-a', tag, sha, '-m', tag);
try {
  execFileSync('git', ['push', 'origin', `refs/tags/${tag}`], { stdio: 'inherit' });
} catch (error) {
  // Leave no local tag behind, so a rerun is not refused.
  git('tag', '-d', tag);
  throw error;
}
console.log(`Pushed ${tag} -> ${sha}`);
