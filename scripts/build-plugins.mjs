import { mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Package each plugin under plugins/ as a `.plugin` archive whose ROOT is the
// canonical plugin layout — `.claude-plugin/plugin.json` and
// `skills/<name>/SKILL.md` at the top level, with NO wrapping directory. This is
// the layout Claude Desktop / Cowork's "Add plugin → Upload" accepts (marketplace
// install doesn't reliably deliver SKILL.md files).
//
// Uses the system `zip` (present on macOS + Linux) instead of an npm archiver
// dependency, so this tool stays dependency-free inside the monorepo: no
// node_modules, no lockfile, nothing for pnpm/CI to resolve.

const repoRoot = resolve(process.argv[2] ?? process.cwd());
const dist = join(repoRoot, 'dist');
const pluginsDir = join(repoRoot, 'plugins');

if (!existsSync(pluginsDir)) {
  console.error(`No plugins/ directory at ${pluginsDir}`);
  process.exit(1);
}

if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(dist, { recursive: true });

const plugins = readdirSync(pluginsDir).filter((n) =>
  statSync(join(pluginsDir, n)).isDirectory(),
);

const built = [];
for (const name of plugins) {
  const pluginDir = join(pluginsDir, name);
  const outPath = join(dist, `${name}.plugin`);

  // Only archive the canonical plugin contents, rooted at the archive root.
  // README.md is intentionally excluded — Cowork's uploader validates the
  // bundle and a Cowork-accepted plugin has only `.claude-plugin/` + `skills/`
  // at the root (the README lives in the repo for humans, not in the artifact).
  const entries = ['.claude-plugin', 'skills'].filter((e) =>
    existsSync(join(pluginDir, e)),
  );
  if (!entries.includes('.claude-plugin')) {
    console.error(`Skipping ${name}: no .claude-plugin/plugin.json`);
    continue;
  }

  // `-r` recurse, `-X` drop extra file attributes, `-q` quiet. `cwd` rooting puts
  // `.claude-plugin/…` and `skills/…` at the archive root (no wrapping dir).
  execFileSync('zip', ['-r', '-X', '-q', outPath, ...entries], {
    cwd: pluginDir,
    stdio: 'inherit',
  });
  built.push(outPath);
}

if (built.length === 0) {
  console.error('No plugins packaged.');
  process.exit(1);
}

console.log('Plugin bundles written:\n  ' + built.join('\n  '));
