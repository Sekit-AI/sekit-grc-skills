import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertManifestVersions, assertReleaseTag } from './release-version.mjs';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

const packageVersion = assertManifestVersions(readJson);

// Only validate a tag when the caller supplies one explicitly. GitHub exposes
// synthetic ref names such as `1/merge` during pull-request CI, so treating the
// ambient ref as a release tag makes ordinary validation fail.
const tag = process.argv[2];
if (tag) {
  assertReleaseTag(tag, packageVersion);
  console.log(`Release ${tag} matches every manifest.`);
} else {
  console.log(`All manifests use version ${packageVersion}.`);
}
