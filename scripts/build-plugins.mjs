import { mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
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
const builtSkills = [];
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

  // ChatGPT's direct skill uploader accepts one skill per `.skill` (ZIP) file.
  // Put SKILL.md and optional skill resources at the archive root, without the
  // wrapping skill-name directory. The separate bundle ZIP is only a convenient
  // way to download every `.skill` file together; users unzip it before upload.
  const sourceSkills = join(pluginDir, 'skills');
  if (existsSync(sourceSkills)) {
    const skillDist = join(dist, 'skills');
    mkdirSync(skillDist, { recursive: true });
    const skillArchives = [];
    const skillNames = readdirSync(sourceSkills).filter((skillName) =>
      statSync(join(sourceSkills, skillName)).isDirectory(),
    );

    for (const skillName of skillNames) {
      const skillDir = join(sourceSkills, skillName);
      const entries = ['SKILL.md', 'agents', 'references', 'scripts', 'assets'].filter((entry) =>
        existsSync(join(skillDir, entry)),
      );
      if (!entries.includes('SKILL.md')) {
        console.error(`Cannot package ${skillName}: no SKILL.md`);
        process.exit(1);
      }

      const skillPath = join(skillDist, `${skillName}.skill`);
      execFileSync('zip', ['-r', '-X', '-q', skillPath, ...entries], {
        cwd: skillDir,
        stdio: 'inherit',
      });
      skillArchives.push(skillPath);
      builtSkills.push(skillPath);
    }

    const bundlePath = join(dist, `${name}-skills.zip`);
    execFileSync('zip', ['-X', '-q', bundlePath, ...skillArchives.map((path) => basename(path))], {
      cwd: skillDist,
      stdio: 'inherit',
    });
    built.push(bundlePath);
  }
}

if (built.length === 0) {
  console.error('No plugins packaged.');
  process.exit(1);
}

console.log('Release artifacts written:\n  ' + [...built, ...builtSkills].join('\n  '));
