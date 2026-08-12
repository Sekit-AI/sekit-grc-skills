# `sekit-grc` plugin

This plugin bundles the skills a cybersecurity or GRC consultant uses to understand Sekit and
carry out real client work over the `sekit-consultant` MCP in Claude, ChatGPT, or Codex.

The plugin and connector intentionally have different names. `sekit-grc` is the skill bundle;
`sekit-consultant` is the authenticated MCP connector it uses.

## Skills

| Skill | Purpose |
|---|---|
| `sekit-onboarding` | Capability discovery, connector readiness, and a safe first task |
| `sekit-mcp-guide` | Shared connector setup, tool reference, data model, and safety rules |
| `analyze-risks` | Create and maintain a risk register |
| `evaluate-controls` | Record an evidence-based control evaluation |
| `run-gap-analysis` | Run a framework-scoped assessment workflow |
| `generate-ropa` | Prepare a GDPR Article 30 record of processing activities |
| `manage-knowledge-base` | Maintain client context in the wiki |
| `manage-evidence-and-deliverables` | Collect evidence and govern deliverables |
| `manage-assets` | Inventory people, vendors, and systems and connect them to GRC work |

Start with `/sekit-grc:sekit-onboarding` if you are new to Sekit. The onboarding skill routes
into the smallest relevant workflow; `sekit-mcp-guide` holds the full operational reference.

## Connector

The OpenAI plugin includes Sekit's registered ChatGPT app mapping and the remote MCP configuration
for Codex. Authorize that bundled connection when prompted; do not create a duplicate connector.

Only in an unbundled OAuth-capable host, configure a custom connector named `sekit-consultant`
with:

```text
URL: https://sekit.ai/api/mcp/consultant
```

Complete Sekit's browser OAuth flow. If the host instead supports custom authorization headers,
create a Personal Access Token in Sekit under
**Settings → AI connections** and use `Authorization: Bearer <your PAT>`. Reconnect after a
Sekit deployment if you need to refresh the connector's tool catalog. Never commit, log, or
share a raw token.

## Install from the public marketplace

In Claude Code:

```text
/plugin marketplace add Sekit-AI/sekit-grc-skills
/plugin install sekit-grc@sekit-grc-skills
```

In the Claude app or Cowork, open **Customize → Plugins** and add the
`Sekit-AI/sekit-grc-skills` repository as a personal marketplace. Release pages also provide a
`sekit-grc.plugin` archive for manual upload.

For ChatGPT and Codex, add the OpenAI repo marketplace:

```sh
codex plugin marketplace add Sekit-AI/sekit-grc-skills
```

Restart the ChatGPT desktop app, select **Sekit GRC Skills** in the Plugins Directory, and
install **Sekit GRC**. The plugin bundles the registered Sekit app mapping for ChatGPT and the
remote MCP configuration for Codex. Each user still completes Sekit's OAuth sign-in and consent
flow for their own account.

## Build from source

From the repository root:

```sh
npm test
```

The command builds `dist/sekit-grc.plugin` and verifies its source and archive shape. The
archive intentionally contains only `.claude-plugin/` and `skills/` at its root for manual
Claude app and Cowork compatibility.

The canonical source is <https://github.com/Sekit-AI/sekit-grc-skills>. Do not edit a mirrored
artifact served by `sekit.ai`; publish here and then update the mirror from a tagged release.
