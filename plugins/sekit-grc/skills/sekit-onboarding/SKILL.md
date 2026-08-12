---
name: sekit-onboarding
description: "Help new and prospective Sekit consultants understand what Sekit can do, choose the right workflow for their immediate goal, connect the consultant MCP, and complete a small first task safely. Use when someone asks what Sekit is, what Sekit can do, how the plugin works, how to get started, which capability or skill to use, or what their first step should be. Also use for a guided product tour, consultant onboarding, connector readiness checks, and first-client setup. Reply in the user's language, avoid a feature dump, and read sekit-mcp-guide before calling any Sekit tool."
---

# Onboard a consultant to Sekit

Help the consultant reach useful work quickly. Explain Sekit in terms of their goal, verify only
the setup needed for that goal, and finish with one small next action. Do not recite the entire
tool catalog; `sekit-mcp-guide` owns operational detail.

## Start with their intent

If the user has already named a goal, use it. Otherwise ask one short question:

> What would you most like to do first: understand a client, assess controls, organize risks,
> collect evidence, or prepare a deliverable?

Answer in the user's language. Keep Sekit product names intact and explain specialist terms in
plain language.

## Explain Sekit in one useful paragraph

Sekit is a workspace for cybersecurity and GRC consultants. It keeps each client's context,
assets, risks, frameworks, control evaluations, evidence requests, conversations, and governed
deliverables together. This plugin lets the consultant ask their AI host to work with that
information through Sekit's consultant connector. Reads stay tenant-scoped and writes are
audited; the
consultant remains responsible for judgments, approvals, and anything sent to a client.

Expand only the capability area relevant to the user's goal:

| Consultant goal | What Sekit helps with | Route to |
|---|---|---|
| Understand a client | Build reusable context in the client wiki and inventory people, vendors, and systems | `manage-knowledge-base`, `manage-assets` |
| Assess posture or a standard | Scope a framework, evaluate assessable controls, record gaps, and use the crosswalk | `run-gap-analysis`, `evaluate-controls` |
| Manage risk | Build and maintain a risk register with likelihood, impact, ownership, and evidence | `analyze-risks` |
| Collect proof from a client | Organize evidence requests into paced packages, review submissions, and link accepted evidence | `manage-evidence-and-deliverables` |
| Produce client work | Upload, review, approve, supersede, and archive governed deliverables | `manage-evidence-and-deliverables` |
| Prepare a GDPR ROPA | Gather processing activities and produce a governed Article 30 record | `generate-ropa` |

Be explicit about limits when relevant: Sekit supports a consultant's professional work; it does
not automatically certify a client, replace legal advice, or turn suggested guidance into a
finding without human judgment.

## Choose the onboarding path

### Explore without connecting

Use this when the user is evaluating Sekit or only wants an explanation.

1. Describe the one or two capabilities that match their stated work.
2. Give a concrete example with a visible outcome.
3. Offer one next step: connect Sekit, inspect an existing client, or start a first workflow.

Do not require a PAT or call tools just to explain the product.

### Start working in Sekit

Use this when the user wants to inspect or change real Sekit data.

1. Read `sekit-mcp-guide` before any tool call.
2. If the connector tools are unavailable, guide the user through the OAuth or PAT setup that
   matches their host, then stop until the connector is available.
3. Call `whoami`. If `organization` is null, explain that the user's Sekit organization setup
   must be completed before client work.
4. Call `list_clients`. Never guess a `client_organization_id`.
5. If the intended client exists, confirm the match when names are ambiguous. If it does not
   exist, offer to create it; call `create_client` only after the user clearly agrees.
6. Route into the specialist skill for the chosen workflow.

For a readiness check, report only what matters: authenticated identity, organization, visible
clients, and whether the requested first workflow can proceed. Never display or ask the user to
paste a raw PAT into the conversation.

## Aim for first value

Recommend one small, reversible outcome instead of launching a whole engagement:

- **New client:** create or select the client, then capture a one-paragraph wiki overview.
- **Existing client:** summarize current risks, open gap analyses, or outstanding evidence
  requests with read-only calls.
- **Framework-led engagement:** list available frameworks and compare guidance coverage before
  creating a gap analysis.
- **Evidence collection:** inspect queued requests and packages before releasing anything.
- **ROPA:** confirm the client and source material before drafting processing activities.

After the first outcome, recap what was learned or created and offer the next specialist
workflow. Do not continue into bulk writes, approvals, archives, portal-token minting, or
client-facing releases without the confirmations required by `sekit-mcp-guide`.

## Avoid these onboarding failures

- Do not overwhelm a new consultant with every feature or MCP tool name.
- Do not present Sekit only as a compliance checklist; connect controls to risk, evidence, and
  client delivery.
- Do not assume a mandated framework. Ask what drives the engagement or explain the
  high-coverage `sekit_csf` starting point.
- Do not invent product capabilities that are absent from this plugin and its MCP guide.
- Do not create demo or client data merely to prove that the connector works.
