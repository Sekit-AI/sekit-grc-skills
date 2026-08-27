# Sekit GRC Skills

[![CI](https://github.com/Sekit-AI/sekit-grc-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Sekit-AI/sekit-grc-skills/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/Sekit-AI/sekit-grc-skills)](https://github.com/Sekit-AI/sekit-grc-skills/releases)

Open-source skills that help cybersecurity and GRC consultants work with
[Sekit](https://sekit.ai) from Claude, ChatGPT, and Codex. The `sekit-grc` plugin turns
natural-language requests into guided, tenant-scoped workflows over the Sekit consultant MCP.

The skills are framework-agnostic: they read frameworks and controls from Sekit instead of
hardcoding one standard.

## What you can do

| Skill | Use it to |
|---|---|
| `sekit-onboarding` | Discover Sekit's capabilities, check connector readiness, and complete a safe first task |
| `sekit-mcp-guide` | Connect the consultant MCP and use its shared operating and safety rules |
| `analyze-risks` | Create and maintain a client's risk register and its remediation actions |
| `evaluate-controls` | Record evidence-based control evaluations |
| `run-gap-analysis` | Run a framework-scoped gap analysis end to end |
| `generate-ropa` | Draft and govern a GDPR Article 30 record of processing activities |
| `manage-knowledge-base` | Read and maintain the per-client wiki |
| `manage-evidence-and-deliverables` | Collect evidence and govern client deliverables |
| `manage-assets` | Inventory people, vendors, and systems and link them to GRC work |

These skills assist professional judgment; they do not certify compliance or replace legal
advice. Writes are real and audited, and client-facing actions require confirmation.

## Install

The `SKILL.md` files under `plugins/sekit-grc/skills/` are canonical. Claude and OpenAI use
different plugin manifests around those same files, so workflow behavior does not fork by host.

### Claude app and Cowork

Open **Customize → Plugins**, add a marketplace from a repository, and enter:

```text
Sekit-AI/sekit-grc-skills
```

Install the `sekit-grc` plugin from the new marketplace. A packaged
`sekit-grc.plugin` file is also attached to each [GitHub release](https://github.com/Sekit-AI/sekit-grc-skills/releases)
for manual upload.

### Claude Code

```text
/plugin marketplace add Sekit-AI/sekit-grc-skills
/plugin install sekit-grc@sekit-grc-skills
```

Then start with:

```text
/sekit-grc:sekit-onboarding
```

### ChatGPT and Codex

The repository includes an OpenAI plugin manifest and repo marketplace. Add it from Codex:

```sh
codex plugin marketplace add Sekit-AI/sekit-grc-skills
```

Restart the ChatGPT desktop app, open the Plugins Directory, choose **Sekit GRC Skills**, and
install **Sekit GRC**. Authorize the bundled Sekit connection when prompted. ChatGPT uses `@` to
select a skill; Codex uses `$`.

This repo-marketplace path is suitable for local testing and direct distribution. Submission to
the universal public Plugins Directory shared by ChatGPT and Codex is a separate OpenAI review
step. The OpenAI plugin maps ChatGPT to Sekit's registered app and gives Codex the remote MCP
configuration; both still require each user to authorize their own Sekit account.

### ChatGPT direct skill upload

Tagged releases also contain one ChatGPT-ready `.skill` file per workflow. This avoids the CLI
when someone only needs the skills:

1. Download the `.skill` files from the latest
   [GitHub release](https://github.com/Sekit-AI/sekit-grc-skills/releases). The
   `sekit-grc-skills.zip` asset contains all nine files for convenient download; unzip it first.
2. In ChatGPT, open **Upload a skill** and upload each `.skill` file you want. For the guided
   starting experience, upload `sekit-mcp-guide.skill` and `sekit-onboarding.skill`. Upload all
   nine for the complete workflow set.
3. Authorize the declared Sekit MCP connection when ChatGPT prompts you, then start a new chat and
   invoke a skill with `@`, for example `@sekit-onboarding`.

Each archive contains exactly one source skill, including its OpenAI metadata and Sekit MCP
dependency. It contains no OAuth token, PAT, client data, or other credential. A direct skill
upload installs that workflow rather than the full `sekit-grc` plugin listing.

## Connect Sekit

The plugin uses Sekit's remote consultant MCP at:

```text
URL: https://sekit.ai/api/mcp/consultant
```

- **ChatGPT and Codex:** install the plugin and complete the Sekit browser sign-in and consent
  flow when prompted; the connector is bundled.
- **Other OAuth-capable hosts:** add the URL as a custom MCP connector and complete the Sekit
  browser sign-in and consent flow.
- **Claude or hosts that support custom authorization headers:** create a Personal Access Token
  under **Settings → AI connections** and use `Authorization: Bearer <your PAT>`.

Treat a PAT like a password. It is shown once; never commit it, paste it into an issue, or
include it in a conversation transcript. A PAT carries the full authority of your Sekit
account; there are no per-token scopes. The `sekit-onboarding` and `sekit-mcp-guide` skills
provide the guided setup and readiness check for each host.

A valid connection is not enough on its own: the tools also require an **active Sekit
subscription or trial** for your firm. Without one, every call answers HTTP 402
`subscription_required`; activate the workspace in the Sekit console (`/app/activate`) and
retry — re-authenticating does not fix it.

## Develop locally

Requirements: Node.js 20 or newer plus the system `zip` and `unzip` commands.

```sh
npm test
```

This validates the Claude and OpenAI manifests plus skill frontmatter, builds
`dist/sekit-grc.plugin`, nine direct-upload `.skill` files, and a convenience ZIP, then verifies
every archive against its canonical source. There are no npm runtime dependencies.

To try an unpublished checkout in Claude Code:

```text
/plugin marketplace add /absolute/path/to/sekit-grc-skills
/plugin install sekit-grc@sekit-grc-skills
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before changing a skill. Please report product or
connector vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.

## Releases and source of truth

This repository is the canonical source for the Sekit GRC plugin. A tag named `vX.Y.Z` must
match both package and plugin manifest versions; the release workflow validates, builds, and
attaches `sekit-grc.plugin`, the nine `.skill` files, their convenience ZIP, and checksums. Sekit
may mirror the Claude artifact at
`https://sekit.ai/downloads/sekit-grc.plugin` for in-product onboarding.

Maintainer: Ricardo Rodríguez, [ricardo@sekit.ai](mailto:ricardo@sekit.ai).

Licensed under the [Apache License 2.0](LICENSE).
