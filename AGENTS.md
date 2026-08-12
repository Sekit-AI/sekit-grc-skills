# AGENTS.md

Instructions for coding agents and contributors in this repository.

## Repository purpose

This is the canonical open-source home of the `sekit-grc` skill bundle. The same
`plugins/sekit-grc/skills/` sources are packaged for Claude, ChatGPT, and Codex. Do not create
host-specific copies of a skill.

## Commands

```sh
npm test
npm run verify-release
```

Node.js 20+, `zip`, and `unzip` are required. The project has no npm dependencies.

## Change rules

- Use English for repository artifacts.
- Preserve client-data safety, tenant orientation, human judgment, and confirmation boundaries.
- Verify public claims and connector contracts; do not document guessed tools or parameters.
- Keep skill frontmatter to exactly `name` and a single-line, quoted, plain-ASCII `description`.
- Keep Claude's manual artifact limited to `.claude-plugin/` and `skills/` at archive root.
- Keep `.claude-plugin`, `.codex-plugin`, package, and marketplace metadata aligned.
- Bump package and both plugin manifest versions together for released content changes.
- Never commit secrets, PATs, client data, private production identifiers, or private transcripts.
  A registered app ID intentionally published in `.app.json` is public packaging metadata, not a
  credential; verify it before changing it.
- Run `npm test` before opening a pull request.

Changes to authentication, authorization, tenant isolation, audit guarantees, token handling,
client-facing egress, or destructive actions require explicit security review.
