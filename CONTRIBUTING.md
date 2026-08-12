# Contributing

Thank you for helping make Sekit's GRC workflows clearer and safer for consultants.

## Before opening a change

- Search existing issues and pull requests.
- Never include client data, credentials, Personal Access Tokens, private assessment material,
  or screenshots from a real tenant.
- Treat the registered app ID in `.app.json` as public packaging metadata, never as a credential;
  verify any replacement against the Sekit connection shown in ChatGPT Developer Mode.
- Keep a skill focused on a recognizable consultant outcome. A product tour belongs in
  `sekit-onboarding`; shared connector mechanics belong in `sekit-mcp-guide`; domain procedure
  belongs in the relevant specialist skill.
- Treat tool names, parameters, enums, and result shapes as contracts. Verify them against the
  live Sekit connector before documenting a change.

## Local workflow

Requirements: Node.js 20 or newer plus `zip` and `unzip`.

```sh
git switch -c feat/short-description
npm test
```

The project intentionally has no npm dependencies. `npm test` builds the manual Claude plugin
artifact and validates both the Claude and OpenAI manifests, all skill frontmatter, archive
shape, and source-to-artifact fidelity.

To test the Claude marketplace locally:

```text
/plugin marketplace add /absolute/path/to/sekit-grc-skills
/plugin install sekit-grc@sekit-grc-skills
```

To test the OpenAI repo marketplace:

```sh
codex plugin marketplace add /absolute/path/to/sekit-grc-skills
```

Restart the ChatGPT desktop app after adding or refreshing a local OpenAI marketplace, then
install **Sekit GRC** from the **Sekit GRC Skills** source.

## Skill rules

Every skill lives at `plugins/sekit-grc/skills/<skill-name>/SKILL.md` and starts with exactly:

```yaml
---
name: skill-name
description: "A single-line description of what the skill does and when it should trigger."
---
```

- Use lowercase kebab-case and make the directory name match `name`.
- Keep `description` on one line, inside double quotes, plain ASCII, under 2,048 characters,
  with no backticks. This is required by manual Claude plugin validation.
- Put detailed procedure and formatting in the body, not the description.
- Write host-neutral instructions. Refer to "the host" or "the authenticated connector" unless
  a setup step truly differs between Claude, ChatGPT, and Codex.
- Preserve the orient-first rule: `whoami`, then `list_clients`, before client-scoped tools.
- Distinguish read-only work, audited writes, governance actions, and client-facing egress.
- Never claim that a suggested control, severity, or remediation is a human-approved finding.
- Prefer references under the skill directory when detail would make `SKILL.md` unwieldy.

The canonical skills are shared by every packaging format. Do not duplicate or fork them into
Claude-specific and OpenAI-specific copies.

## Versioning

Any released change to packaged content must update the same semantic version in:

- `package.json`
- `plugins/sekit-grc/.claude-plugin/plugin.json`
- `plugins/sekit-grc/.codex-plugin/plugin.json`

Use a patch version for compatible instruction fixes, a minor version for a new skill or
capability, and a major version for breaking workflow or installation changes.

Maintainers publish by creating a signed or annotated `vX.Y.Z` tag after the pull request is
merged. GitHub Actions verifies the tag, rebuilds the archive, and attaches it to the release.

## Pull requests

Explain the consultant scenario before and after the change, what deliberately did not change,
and how you tested it. Keep unrelated cleanup out of the pull request. By contributing, you
agree that your contribution is licensed under Apache-2.0.
