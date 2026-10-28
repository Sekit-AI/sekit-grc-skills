import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const pluginRoot = resolve(root, 'plugins/sekit-grc');
const skillsRoot = resolve(pluginRoot, 'skills');
const artifact = resolve(root, 'dist/sekit-grc.plugin');
const skillDist = resolve(root, 'dist/skills');
const skillBundle = resolve(root, 'dist/sekit-grc-skills.zip');

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

function zipEntries(path = artifact) {
  return execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' })
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
  assert.equal(codex.apps, './.app.json');
  assert.equal(codex.mcpServers, './.mcp.json');

  assert.deepEqual(
    Object.keys(claude).sort(),
    ['description', 'name', 'version'],
    'the manual Claude artifact requires a minimal manifest',
  );
});

test('OpenAI packaging binds the registered Sekit app and OAuth MCP endpoint', () => {
  const app = json('plugins/sekit-grc/.app.json');
  const mcp = json('plugins/sekit-grc/.mcp.json');
  const guide = readFileSync(
    resolve(root, 'plugins/sekit-grc/skills/sekit-mcp-guide/SKILL.md'),
    'utf8',
  );

  assert.deepEqual(app, {
    apps: {
      sekit: {
        id: 'asdk_app_6a7c4a50d7dc8191a308cd414183e21e',
      },
    },
  });
  assert.deepEqual(mcp, {
    mcpServers: {
      'sekit-consultant': {
        type: 'http',
        url: 'https://sekit.ai/api/mcp/consultant',
        oauth_resource: 'https://sekit.ai/api/mcp/consultant',
      },
    },
  });
  assert.match(guide, /authorize its bundled Sekit\n\s+connection/);
  assert.match(guide, /Do not create a duplicate connector/);
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

  assert.equal(skillNames.length, 10);
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

    assert.ok(skillName.length <= 64, `${skillName}: name must be at most 64 characters`);
    assert.match(skillName, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${skillName}: name must be kebab-case`);

    const description = JSON.parse(lines[1].slice('description: '.length));
    // 1024 is the Agent Skills spec ceiling (https://agentskills.io/specification) and
    // the limit ChatGPT's uploader enforces. A looser bound here let a 1071-character
    // description reach a release, where it failed in the user's browser instead.
    assert.ok(
      description.length > 20 && description.length <= 1024,
      `${skillName}: description is ${description.length} characters (must be 21-1024)`,
    );
    assert.match(description, /^[\x20-\x7E]+$/, `${skillName} description must be plain ASCII`);
    assert.ok(!description.includes('`'), `${skillName} description must not contain backticks`);
    assert.ok(source.slice(frontmatter[0].length).trim().length > 0);

    assert.doesNotMatch(source, /\b(?:Rails|ActionPolicy|PaperTrail|FastMCP)\b/);
    assert.doesNotMatch(source, /\brelated_frameworks\b/);

    const openai = readFileSync(resolve(skillsRoot, skillName, 'agents/openai.yaml'), 'utf8');
    assert.match(openai, new RegExp(`default_prompt: "Use \\$${skillName}\\b`));
    assert.match(openai, /value: "sekit-consultant"/);
    assert.match(openai, /transport: "streamable_http"/);
    assert.match(openai, /url: "https:\/\/sekit\.ai\/api\/mcp\/consultant"/);
  }
});

test('analyze-risks writes risk statements, not copied gap labels (SK-736)', () => {
  const risks = readFileSync(resolve(skillsRoot, 'analyze-risks/SKILL.md'), 'utf8');
  const section = risks.match(/\n#### Risk statement, not a gap\n([\s\S]*?)(?=\n#{1,4} |$)/);
  assert.ok(section, 'analyze-risks must carry the "Risk statement, not a gap" standard');

  // The labels the ticket names as gap prose; a risk title or description never opens with one.
  const gapLabel = /^(?:lack of|absence of|absent|no|missing|insufficient|inadequate|gap|without)\b/i;
  const pairs = [...section[1].matchAll(/^\| (.+?) \| (.+?) \|$/gm)]
    .map(([, gap, risk]) => [gap.replace(/[*`]/g, '').trim(), risk.replace(/[*`]/g, '').trim()])
    .filter(([gap]) => !/^[-:]+$/.test(gap) && !/^Gap wording/i.test(gap));
  assert.ok(pairs.length >= 3, 'the standard must show at least three gap/risk pairs');
  for (const [gap, risk] of pairs) {
    assert.doesNotMatch(risk, gapLabel, `"${risk}" reads as a gap label, not a risk statement`);
    assert.notEqual(risk.toLowerCase(), gap.toLowerCase());
  }

  const example = section[1].match(/A full `description` for the first row: \*"([^"]+)"\*/);
  assert.ok(example, 'the standard must show one full risk description');
  assert.doesNotMatch(example[1], gapLabel, 'the example description must lead with the event');

  const controls = readFileSync(resolve(skillsRoot, 'evaluate-controls/SKILL.md'), 'utf8');
  const summary = controls.match(/^`summary` — [\s\S]*?\n\n/m);
  assert.ok(summary, 'evaluate-controls must document the summary field');
  assert.match(summary[0], /what is missing/, 'gap prose stays gap prose');
  assert.match(summary[0], /\*\*analyze-risks\*\*/, 'the summary field points at the risk-statement contrast');
});

test('no skill names a tool Sekit retired (SK-584 packages + threads, SK-749 evidence requests)', () => {
  // Sekit removed these from the consultant MCP (packages + threads in SK-584, the whole
  // evidence-request lifecycle in SK-749). A skill that still names one teaches an agent to
  // call a tool that does not exist. The retirement notes name the families as globs
  // (`*_evidence_request*`), never a concrete tool name.
  const retired = [
    'list_evidence_packages',
    'get_evidence_package',
    'create_evidence_package',
    'update_evidence_package',
    'release_evidence_package',
    'close_evidence_package',
    'reopen_evidence_package',
    'set_evidence_request_package',
    'post_thread_message',
    'list_thread',
    'list_evidence_requests',
    'create_evidence_request',
    'get_evidence_request',
    'get_submission_markdown',
    'update_evidence_request',
    'review_evidence_request',
    'release_evidence_request',
    'archive_evidence_request',
    'restore_evidence_request',
    'generate_evidence_requests',
    'release_wave',
    'instantiate_evidence_plan',
  ];
  const tool = new RegExp(`\\b(?:${retired.join('|')})\\b`);
  // Positive control: a broken escape would make the negative check pass vacuously.
  assert.match('call `create_evidence_request` now', tool);
  assert.doesNotMatch('`create_evidence_request_v2`', tool);
  for (const skillName of readdirSync(skillsRoot)) {
    const source = readFileSync(resolve(skillsRoot, skillName, 'SKILL.md'), 'utf8');
    const hit = source.match(tool);
    assert.equal(hit, null, `${skillName} names retired tool ${hit?.[0]}`);
  }
});

test('the guide teaches every SK-810 read under its registered name', () => {
  // SK-810 registered these read-only consultant tools. Two shipped under names other than
  // the ticket proposed, and those proposals were never registered, so no skill may name them.
  const reads = [
    'get_collection_session',
    'get_collection_session_board',
    'get_collection_session_ask',
    'list_collection_session_conversations',
    'get_collection_preview',
    'get_portal_conversation',
    'list_reports',
    'get_report',
    'get_report_markdown',
    'list_risk_versions',
    'get_risk_version',
    'list_control_evaluation_versions',
    'get_control_evaluation_version',
    'get_gap_analysis_run',
    'list_agent_runs',
    'get_agent_run',
    'get_control_mappings',
    'get_reverse_control_mappings',
  ];
  const guide = readFileSync(resolve(skillsRoot, 'sekit-mcp-guide/SKILL.md'), 'utf8');
  for (const name of reads) {
    assert.match(guide, new RegExp(`\`${name}[\`(]`), `sekit-mcp-guide must name ${name}`);
  }
  const unregistered = /\b(?:preview_collection_asks|reverse_lookup_control)\b/;
  for (const skillName of readdirSync(skillsRoot)) {
    const source = readFileSync(resolve(skillsRoot, skillName, 'SKILL.md'), 'utf8');
    const hit = source.match(unregistered);
    assert.equal(hit, null, `${skillName} names unregistered tool ${hit?.[0]}`);
  }
});

test("a person's write applies directly and is not an Agent update (SK-853)", () => {
  const oldClaim = /your own writes included|external agent through this MCP/;
  for (const skillName of readdirSync(skillsRoot)) {
    if (!statSync(resolve(skillsRoot, skillName)).isDirectory()) continue;
    const source = readFileSync(resolve(skillsRoot, skillName, 'SKILL.md'), 'utf8');
    const hit = source.match(oldClaim);
    assert.equal(hit, null, `${skillName} still queues a person's MCP write: ${hit?.[0]}`);
  }

  const guide = readFileSync(resolve(skillsRoot, 'sekit-mcp-guide/SKILL.md'), 'utf8');
  const section = guide.match(
    /### Agent updates — reviewing what agents wrote\n([\s\S]*?)(?=\n### )/,
  );
  assert.ok(section, 'sekit-mcp-guide must keep the Agent updates section');
  const rules = section[1];
  assert.match(rules, /applies directly/);
  assert.match(rules, /not an Agent\s+update/);
  assert.match(rules, /vía Claude/);
  assert.match(rules, /vía token/);
  assert.match(rules, /«<client> \(OAuth\)»/);
  assert.doesNotMatch(guide, /line in \*\*Agent updates\*\*/);
  assert.match(rules, /Sekura/);
  assert.match(rules, /agent user/);
  assert.match(rules, /sign-off is not a permission/);
  assert.match(rules, /including on a change of their own/);
  assert.doesNotMatch(rules, /cannot approve/);

  for (const name of [
    'manage-evidence-and-deliverables',
    'generate-ropa',
    'sekit-onboarding',
    'evaluate-controls',
  ]) {
    const source = readFileSync(resolve(skillsRoot, name, 'SKILL.md'), 'utf8');
    assert.match(
      source,
      /appl(?:y|ies) directly/,
      `${name} must say a person's write applies directly`,
    );
  }

  const controls = readFileSync(resolve(skillsRoot, 'evaluate-controls/SKILL.md'), 'utf8');
  assert.match(controls, /person's import stores no `reasoning`/);
  assert.match(controls, /not an Agent update/);
});

test('every control-evaluation write names its gap analysis (SK-873)', () => {
  // Sekit no longer files an evaluation without a gap analysis into a catch-all one it creates.
  const synthesized = /\bsynthesi[sz](?:e|ed|es|ing)\b|Imported control evaluations|no gap analysis specified/i;
  assert.match('Sekit attaches a synthesized per-(client, framework) analysis', synthesized);
  assert.doesNotMatch('`analysis/` (risks, synthesis)', synthesized);
  for (const skillName of readdirSync(skillsRoot)) {
    if (!statSync(resolve(skillsRoot, skillName)).isDirectory()) continue;
    const source = readFileSync(resolve(skillsRoot, skillName, 'SKILL.md'), 'utf8');
    const hit = source.match(synthesized);
    assert.equal(hit, null, `${skillName} still lets Sekit pick the analysis: ${hit?.[0]}`);
  }

  const controls = readFileSync(resolve(skillsRoot, 'evaluate-controls/SKILL.md'), 'utf8');
  const filing = controls.match(/\n## Filing into a gap analysis\n([\s\S]*?)(?=\n## )/);
  assert.ok(filing, 'evaluate-controls must keep the filing section');
  assert.match(filing[1], /`gap_analysis_id`\*\* is required/);
  assert.match(filing[1], /`list_gap_analyses\(client_organization_id\)`/);
  assert.match(filing[1], /`create_gap_analysis`/);
  assert.match(
    filing[1],
    /\(error: validation_error — Invalid arguments for tool "create_control_evaluation"\. \[gap_analysis_id: is required;/,
  );
  assert.match(
    filing[1],
    /\(error: validation_error — Invalid arguments for tool "import_control_evaluations"\. \[evaluations\.<N>\.gap_analysis_id: is required;/,
  );

  const batch = controls.match(/\n8\. \*\*Batch\*\*([\s\S]*?)(?=\n\n)/);
  assert.ok(batch, 'evaluate-controls must keep the Batch step');
  assert.match(batch[1], /Every row carries its own\s+`gap_analysis_id`/);
  assert.match(batch[1], /several gap analyses/);
  assert.doesNotMatch(controls, /perimeter_id/);
});

test('manage-assets teaches every asset type, class, field and reference Sekit validates (SK-939)', () => {
  // Mirrors apps/web/src/lib/asset-templates.ts in sekit-monorepo at 64a6be33 (SK-935).
  const device = ['ownership', 'os', 'disk_encrypted'];
  const templates = {
    person: { '': [] },
    third_party: { '': [] },
    information: { '': ['classification', 'personal_data', 'health_data', 'access'] },
    system: {
      cloud: ['account', 'region', 'environment'],
      saas: ['mfa', 'receives_user_data'],
      application: ['authentication', 'integrations'],
      repository: ['auto_deploy'],
      backup: [],
      domain: [],
      other: [],
    },
    device: { laptop: device, phone: device, other: device },
  };
  const answer = ['yes', 'no', 'unknown'];
  const text = [];
  const values = {
    classification: ['public', 'internal', 'confidential', 'restricted'],
    personal_data: answer,
    health_data: answer,
    mfa: answer,
    receives_user_data: answer,
    auto_deploy: answer,
    disk_encrypted: answer,
    environment: ['production', 'other'],
    ownership: ['company', 'personal'],
    account: text,
    region: text,
    authentication: text,
    integrations: text,
    access: text,
    os: text,
  };
  const references = {
    supplier_asset_id: { carrier: 'system', targets: ['third_party'] },
    assignee_asset_id: { carrier: 'device', targets: ['person'] },
    location_asset_ids: { carrier: 'information', targets: ['system', 'third_party'] },
  };

  const skill = readFileSync(resolve(skillsRoot, 'manage-assets/SKILL.md'), 'utf8');
  const rows = (heading) => {
    const section = skill.match(new RegExp(`\\n### ${heading}\\n([\\s\\S]*?)(?=\\n### |\\n## )`));
    assert.ok(section, `manage-assets must keep the ${heading} table`);
    const lines = section[1].split('\n');
    return lines
      .filter((line, i) => line.startsWith('| `') && !lines[i + 1]?.startsWith('|---'))
      .map((line) => line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1])));
  };
  const sorted = (list) => [...list].sort();

  const taught = {};
  for (const [[type], classes, fields, refs] of rows('Asset registry')) {
    for (const assetClass of classes.length > 0 ? classes : ['']) {
      taught[type] ??= {};
      taught[type][assetClass] = sorted(fields);
    }
    for (const ref of refs) assert.equal(references[ref]?.carrier, type, `${ref} is not carried by ${type}`);
  }
  const expected = Object.fromEntries(
    Object.entries(templates).map(([type, byClass]) => [
      type,
      Object.fromEntries(Object.entries(byClass).map(([assetClass, fields]) => [assetClass, sorted(fields)])),
    ]),
  );
  assert.deepEqual(taught, expected, 'the registry must list each (type, class) with exactly its fields');

  const taughtValues = {};
  for (const [fields, options] of rows('Field values')) {
    for (const field of fields) taughtValues[field] = sorted(options);
  }
  assert.deepEqual(
    taughtValues,
    Object.fromEntries(Object.entries(values).map(([field, options]) => [field, sorted(options)])),
    'every field must list exactly its values',
  );

  const taughtRefs = {};
  for (const [[param], [carrier], targets] of rows('References')) {
    taughtRefs[param] = { carrier, targets: sorted(targets) };
  }
  assert.deepEqual(taughtRefs, references, 'every reference must name its carrier and target types');

  assert.match(skill, /`ownership` \| `company` \\\| `personal` \(required/, 'a device needs an ownership answer');
  assert.match(skill, /details\.<key>/, 'manage-assets must say an unknown details key is refused');
  assert.doesNotMatch(skill, /one inventory, three types/i);
  assert.doesNotMatch(skill, /data_processed|contract_ref|"hosting"/, 'free-form details are refused now');
  assert.doesNotMatch(skill, /default owner/i, 'not shipped in SK-935');
  assert.doesNotMatch(skill, /external_ref|matched: true/, 'sync-asset-inventory owns the sync contract');
  assert.match(skill, /\*\*sync-asset-inventory\*\*/, 'manage-assets must route a sync to sync-asset-inventory');
});

test('sync-asset-inventory teaches the SK-940 external_ref contract and never archives (SK-941)', () => {
  const skill = readFileSync(resolve(skillsRoot, 'sync-asset-inventory/SKILL.md'), 'utf8');

  // The server's ExternalRefSchema (apps/web/src/lib/asset-external-ref.ts, SK-940).
  assert.ok(skill.includes('`^[a-z][a-z0-9_.-]{0,63}$`'), 'the source rule must match the server');
  assert.match(skill, /1 to 512 characters/);
  assert.match(skill, /`matched: true`/);
  assert.match(skill, /`archived`/);
  assert.match(skill, /`update_asset` has no such parameter/);

  const reconcile = skill.match(/\n### 4\. Reconcile\n([\s\S]*?)(?=\n### )/);
  assert.ok(reconcile, 'sync-asset-inventory must keep the Reconcile table');
  const outcomes = [...reconcile[1].matchAll(/\| \*\*([a-z ]+)\*\* \| ([^|]+) \|/g)].map((m) => [m[1], m[2].trim()]);
  assert.deepEqual(outcomes, [
    ['unchanged', 'none'],
    ['update', '`update_asset` with only what changed'],
    ['type mismatch', 'none; report it'],
    ['possible duplicate', 'none; report it'],
    ['create', '`create_asset` with the reference'],
    ['disappeared', 'none; report it'],
  ]);

  // Archive and restore appear only in the sentence that forbids them.
  const governance = [...skill.matchAll(/`(archive_asset|restore_asset)`/g)].map((m) => m.index);
  assert.equal(governance.length, 2);
  for (const index of governance) {
    assert.match(skill.slice(skill.lastIndexOf('\n', index), index), /Never call/);
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

test('ChatGPT direct-upload skill archives are valid and source-exact', () => {
  const skillNames = readdirSync(skillsRoot)
    .filter((entry) => statSync(resolve(skillsRoot, entry)).isDirectory())
    .sort();
  const archives = readdirSync(skillDist).filter((entry) => entry.endsWith('.skill')).sort();

  assert.deepEqual(archives, skillNames.map((name) => `${name}.skill`));

  for (const skillName of skillNames) {
    const skillRoot = resolve(skillsRoot, skillName);
    const skillArtifact = resolve(skillDist, `${skillName}.skill`);
    assert.doesNotThrow(() => execFileSync('unzip', ['-tq', skillArtifact], { stdio: 'pipe' }));

    const entries = zipEntries(skillArtifact);
    assert.ok(entries.includes('SKILL.md'), `${skillName} must put SKILL.md at archive root`);
    assert.ok(!entries.some((entry) => entry.startsWith(`${skillName}/`)));

    const packagedFiles = entries.filter((entry) => !entry.endsWith('/')).sort();
    const expectedFiles = filesBelow(skillRoot).map((path) => relative(skillRoot, path)).sort();
    assert.deepEqual(packagedFiles, expectedFiles);

    for (const entry of expectedFiles) {
      const packaged = execFileSync('unzip', ['-p', skillArtifact, entry]);
      const source = readFileSync(resolve(skillRoot, entry));
      assert.deepEqual(packaged, source, `${skillName}/${entry} differs from source`);
    }
  }

  assert.doesNotThrow(() => execFileSync('unzip', ['-tq', skillBundle], { stdio: 'pipe' }));
  assert.deepEqual(zipEntries(skillBundle).sort(), archives);
  for (const archive of archives) {
    const bundled = execFileSync('unzip', ['-p', skillBundle, archive]);
    const standalone = readFileSync(resolve(skillDist, archive));
    assert.deepEqual(bundled, standalone, `${archive} differs inside the convenience bundle`);
  }
});

test('the build refuses to package a skill that violates the frontmatter spec', () => {
  const buildScript = resolve(root, 'scripts/build-plugins.mjs');

  // A throwaway plugin tree, so the guard is exercised against a real violation
  // rather than asserted in the abstract. Same shape the real plugin has.
  function fixture(description) {
    const dir = mkdtempSync(join(tmpdir(), 'sekit-grc-build-'));
    const skillDir = resolve(dir, 'plugins/probe/skills/probe-skill');
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(resolve(dir, 'plugins/probe/.claude-plugin'), { recursive: true });
    writeFileSync(
      resolve(dir, 'plugins/probe/.claude-plugin/plugin.json'),
      JSON.stringify({ name: 'probe', version: '0.0.0', description: 'probe' }),
    );
    writeFileSync(
      resolve(skillDir, 'SKILL.md'),
      `---\nname: probe-skill\ndescription: ${JSON.stringify(description)}\n---\n\nBody.\n`,
    );
    return dir;
  }

  function build(dir) {
    try {
      execFileSync('node', [buildScript, dir], { encoding: 'utf8', stdio: 'pipe' });
      return { status: 0, stderr: '' };
    } catch (error) {
      return { status: error.status, stderr: String(error.stderr ?? '') };
    }
  }

  // Positive control: a compliant skill of the same shape builds cleanly, so a
  // failure below is the length rule and not the fixture.
  const good = build(fixture('A'.repeat(1024)));
  assert.equal(good.status, 0, `a 1024-character description must build: ${good.stderr}`);

  const tooLong = build(fixture('A'.repeat(1025)));
  assert.equal(tooLong.status, 1, 'a 1025-character description must fail the build');
  assert.match(tooLong.stderr, /probe-skill: description is 1025 characters \(max 1024\)/);

});

test('release and security metadata work in their standard consumer flows', () => {
  const releaseWorkflow = readFileSync(resolve(root, '.github/workflows/release.yml'), 'utf8');
  const issueConfig = readFileSync(resolve(root, '.github/ISSUE_TEMPLATE/config.yml'), 'utf8');

  assert.match(releaseWorkflow, /sha256sum sekit-grc\.plugin sekit-grc-skills\.zip > SHA256SUMS/);
  assert.match(releaseWorkflow, /\(cd skills && sha256sum \*\.skill\) >> SHA256SUMS/);
  assert.match(releaseWorkflow, /dist\/skills\/\*\.skill/);
  assert.match(releaseWorkflow, /dist\/sekit-grc-skills\.zip/);
  assert.doesNotMatch(releaseWorkflow, /sha256sum dist\/sekit-grc\.plugin/);
  assert.match(issueConfig, /url: https:\/\//);
  assert.doesNotMatch(issueConfig, /url: mailto:/);
});
