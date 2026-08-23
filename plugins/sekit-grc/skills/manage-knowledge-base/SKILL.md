---
name: manage-knowledge-base
description: "Read and write a Sekit client's per-client knowledge base (the wiki) over the consultant MCP. List pages, search and read for context, and write or append markdown pages. Use when the user wants to look up what is known about a Sekit client, capture notes or findings into the client's knowledge base, summarize an assessment, or read context before analyzing risks or controls. This is the same per-client wiki the Sekit web Knowledge Base shows. Read the sekit-mcp-guide skill first."
---

# Manage the client knowledge base (wiki)

Read and maintain a client's **knowledge base** — the per-client, markdown wiki that Sekit's
agents and consultants co-maintain (the same pages the web **Knowledge Base** UI renders). Read
**sekit-mcp-guide** first.

## When to use

- **Before** analyzing risks or controls — pull context the client wiki already holds (posture,
  prior findings, OSINT, declared facts).
- **After** doing work — capture notes, a summary, or a narrative into the wiki so it compounds.
- Whenever the user asks "what do we know about <client>?"

## The tools

| Tool | Purpose |
|---|---|
| `wiki_list(client_organization_id)` | Catalog of pages — **start here** to see paths + titles before reading. |
| `wiki_read(client_organization_id, path)` | Read one page. |
| `wiki_search(client_organization_id, query)` | Find pages/passages by text. |
| `wiki_write(client_organization_id, path, body)` | Create or **overwrite** a page (returns a confirmation string, or `"(error: ...)"`). |
| `wiki_append(client_organization_id, path, line)` | Append ONE line to a page (create-if-absent). The argument is `line`, not `body`; the newline is added for you. |

## Process

1. **Orient** — `whoami` → `list_clients` → resolve `client_organization_id` (see
   sekit-mcp-guide).
2. **Survey** — `wiki_list(...)` to see what exists. Don't guess paths.
3. **Read / search** — `wiki_read` a specific page, or `wiki_search` to locate context across
   pages.
4. **Write** — `wiki_write` to create/replace, `wiki_append` to add. **`wiki_write` overwrites
   the whole page** — read first if you're editing, and preserve content you don't mean to drop.

## Page conventions

Pages are markdown with a YAML frontmatter block. Follow the existing structure in `wiki_list`
rather than inventing one. A typical page:

```markdown
---
title: <short page title>
summary: <one-line summary used in the catalog>
---

# <heading>

<markdown body — link related pages, cite sources>
```

Common path prefixes you'll see: `identity/` (the company), `evidence/` (findings, OSINT),
`posture/` (per-domain posture), `analysis/` (risks, synthesis), plus free-form notes. Match what
the client already uses.

## Using the wiki as evidence

A wiki page can back a risk or control evaluation: `create_evidence(..., kind="wiki",
wiki_path="<path>")`. See **manage-evidence-and-deliverables**.

## Notes

- The wiki is shared with Sekit's agents and the web UI; writes are attributed to your
  authenticated connector identity
  and shown with human/agent provenance in the Knowledge Base UI.
- `wiki_write` is a full-page overwrite with no merge — when in doubt, `wiki_append` or read +
  re-write the merged body.
