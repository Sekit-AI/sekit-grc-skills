import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const pluginRoot = resolve(root, 'plugins/sekit-grc');
const skillsRoot = resolve(pluginRoot, 'skills');
const artifact = resolve(root, 'dist/sekit-grc.plugin');

function json(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function filesBelow(path) {
  const files = [];
  for (const entry of readdirSync(path)) {
    const absolute = resolve(path, entry);
    if (statSync(absolute).isDirectory()) files.push(...filesBelow(absolute));
    else files.push(absolute);
  }
  return files;
}

function zipEntries() {
  return execFileSync('unzip', ['-Z1', artifact], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

test('Claude and OpenAI manifests describe the same plugin version', () => {
  const pkg = json('package.json');
  const claude = json('plugins/sekit-grc/.claude-plugin/plugin.json');
  const codex = json('plugins/sekit-grc/.codex-plugin/plugin.json');

  assert.equal(claude.name, 'sekit-grc');
  assert.equal(codex.name, claude.name);
  assert.equal(codex.version, claude.version);
  assert.equal(pkg.version, claude.version);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(codex.license, pkg.license);
  assert.equal(codex.skills, './skills/');

  assert.deepEqual(
    Object.keys(claude).sort(),
    ['description', 'name', 'version'],
    'the manual Claude artifact requires a minimal manifest',
  );
});

test('Claude and OpenAI marketplaces point to the shared plugin directory', () => {
  const claude = json('.claude-plugin/marketplace.json');
  const codex = json('.agents/plugins/marketplace.json');
  const claudeEntry = claude.plugins.find(({ name }) => name === 'sekit-grc');
  const codexEntry = codex.plugins.find(({ name }) => name === 'sekit-grc');

  assert.equal(claudeEntry?.source, './plugins/sekit-grc');
  assert.equal(codexEntry?.source?.path, './plugins/sekit-grc');
  assert.equal(codexEntry?.policy?.installation, 'AVAILABLE');
  assert.equal(codexEntry?.policy?.authentication, 'ON_INSTALL');
  assert.equal(codexEntry?.category, 'Productivity');
});

test('every skill has portable, valid frontmatter', () => {
  const skillNames = readdirSync(skillsRoot)
    .filter((entry) => statSync(resolve(skillsRoot, entry)).isDirectory())
    .sort();

  assert.equal(skillNames.length, 9);
  assert.ok(skillNames.includes('sekit-onboarding'));

  for (const skillName of skillNames) {
    const path = resolve(skillsRoot, skillName, 'SKILL.md');
    assert.ok(existsSync(path), `${skillName} must contain SKILL.md`);
    const source = readFileSync(path, 'utf8');
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(frontmatter, `${skillName} must start with YAML frontmatter`);

    const lines = frontmatter[1].split('\n');
    assert.equal(lines.length, 2, `${skillName} frontmatter must contain only name and description`);
    assert.equal(lines[0], `name: ${skillName}`);
    assert.match(lines[1], /^description: ".*"$/);

    const description = JSON.parse(lines[1].slice('description: '.length));
    assert.ok(description.length > 20 && description.length <= 2048);
    assert.match(description, /^[\x20-\x7E]+$/, `${skillName} description must be plain ASCII`);
    assert.ok(!description.includes('`'), `${skillName} description must not contain backticks`);
    assert.ok(source.slice(frontmatter[0].length).trim().length > 0);

    assert.doesNotMatch(source, /\b(?:Rails|ActionPolicy|PaperTrail|FastMCP)\b/);
  }
});

test('the built Claude artifact is a valid, source-exact plugin archive', () => {
  assert.ok(existsSync(artifact), 'npm test must build dist/sekit-grc.plugin first');
  assert.doesNotThrow(() => execFileSync('unzip', ['-tq', artifact], { stdio: 'pipe' }));

  const entries = zipEntries();
  const roots = [...new Set(entries.map((entry) => entry.split('/')[0]).filter(Boolean))].sort();
  assert.deepEqual(roots, ['.claude-plugin', 'skills']);
  assert.ok(!entries.some((entry) => entry.startsWith('.codex-plugin/')));

  const packagedFiles = entries.filter((entry) => !entry.endsWith('/')).sort();
  const expectedFiles = [
    resolve(pluginRoot, '.claude-plugin/plugin.json'),
    ...filesBelow(skillsRoot),
  ]
    .map((path) => relative(pluginRoot, path))
    .sort();
  assert.deepEqual(packagedFiles, expectedFiles);

  for (const entry of expectedFiles) {
    const packaged = execFileSync('unzip', ['-p', artifact, entry]);
    const source = readFileSync(resolve(pluginRoot, entry));
    assert.deepEqual(packaged, source, `${entry} differs between source and artifact`);
  }
});

test('release and security metadata work in their standard consumer flows', () => {
  const releaseWorkflow = readFileSync(resolve(root, '.github/workflows/release.yml'), 'utf8');
  const issueConfig = readFileSync(resolve(root, '.github/ISSUE_TEMPLATE/config.yml'), 'utf8');

  assert.match(releaseWorkflow, /working-directory: dist\n\s+run: sha256sum sekit-grc\.plugin > sekit-grc\.plugin\.sha256/);
  assert.doesNotMatch(releaseWorkflow, /sha256sum dist\/sekit-grc\.plugin/);
  assert.match(issueConfig, /url: https:\/\//);
  assert.doesNotMatch(issueConfig, /url: mailto:/);
});
