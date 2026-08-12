---
name: generate-ropa
description: "Draft and deliver a GDPR Art. 30 Record of Processing Activities (ROPA / RAT, 'registro de actividades de tratamiento') for a Sekit client over the consultant MCP. Gathers what Sekit already knows (wiki, assets, contacts, gap analysis), collects the rest from the client via solicitudes, drafts one entry per processing activity with the Art. 30(1)/(2) fields, and ships it as a governed artifact (kind ropa) linked as evidence on the GDPR 30.1/30.2 controls. Use when the user asks for a ROPA, a RAT, a record/register of processing activities, Art. 30 compliance, or to close a GDPR gap on records of processing. Read the sekit-mcp-guide skill first."
---

# Generate a ROPA (GDPR Art. 30)

The ROPA is the written record of a client's processing activities — the backbone of GDPR
accountability and the artifact a supervisory authority asks for first. Sekit models it as a
governed deliverable: **artifact `kind="ropa"`**, linked as evidence on the GDPR framework's
**30.1** (controller record) / **30.2** (processor record) controls. Read **sekit-mcp-guide**
first; the upload/approval mechanics live in **manage-evidence-and-deliverables**.

Three phases: **GATHER → DRAFT → DELIVER**. Never fabricate an activity or a field — what the
client hasn't confirmed goes in as an explicit `OPEN:` item, not a guess.

## 1. GATHER

Start from what Sekit already knows, then ask the client only for what's missing.

**Already in Sekit:**

- `get_client` — legal name, industry, size, country (drives role and transfer questions).
- `wiki_search` / `wiki_read` — `identity/company.md`, `evidence/business_context.md` and any
  intake notes: business lines, customer geography, data classes already surfaced.
- `list_assets` + `list_asset_links` — systems and vendors are your candidate processing
  activities and recipients (a CRM asset ⇒ a "customer management" activity; a payroll SaaS ⇒
  a processor to name).
- `list_contacts` — who is the DPO / privacy owner (Art. 30 wants their contact details).
- `list_gap_analyses` + `list_control_evaluations` under the `gdpr` framework — if a GDPR gap
  analysis exists, its 30.1/30.2 verdicts and linked evidence tell you what's already known.
- `list_framework_controls(framework_code="gdpr")` — the 30.1/30.2 requirement text to quote
  when explaining the obligation to the client.

**Missing facts → ask the client via a solicitud, don't guess:**

1. `create_evidence_package` — one package, e.g. "ROPA — información de tratamientos".
2. `create_evidence_request` per topic, linked to the client contact
   (`client_contact_id`) and, when a GDPR gap analysis exists, to its 30.1 control evaluation
   (`control_evaluation_id`) so the answer lands as evidence where the gap is. Ask, per
   activity: purpose; categories of people and of data (flag special categories); who receives
   the data (processors, third parties); transfers outside the EU and under what safeguard;
   how long data is kept; the security measures that protect it.
3. **`set_evidence_request_package(evidence_request_id, package_id, position)` for EACH
   request** — requests are created standalone (`package_id` empty) and membership is
   explicit; releasing a package only delivers its OWN members, and releasing an empty
   package "succeeds" while the client receives nothing.
4. `release_evidence_package` — nothing is visible to the client until released. (Skipping
   the package? Release requests individually with `release_evidence_request` or in paced
   batches with `release_wave`.)
5. Read replies with `get_submission_markdown`; follow up with `post_thread_message`.

## 2. DRAFT

One entry per **processing activity** (payroll, recruitment, CRM/customers, marketing,
support, invoicing, CCTV, web analytics…). A typical SME has 8–20. Write the document in the
client's working language (Spanish clients expect "Registro de Actividades de Tratamiento").

**Role decides the record shape — a client can need BOTH sections:**

**Controller record — Art. 30(1)** (the client decides purposes/means):

| Field | Notes |
|---|---|
| Controller identity + contacts | plus joint controller, EU representative and DPO where they exist |
| Purposes of the processing | one line, specific ("nómina y obligaciones laborales", not "HR") |
| Categories of data subjects | employees, customers, leads, visitors… |
| Categories of personal data | flag special categories (Art. 9) and criminal-offence data (Art. 10) explicitly |
| Categories of recipients | processors and third parties, incl. those in third countries |
| Transfers to third countries | destination + safeguard (adequacy / SCCs / BCRs / Art. 49 derogation + its documentation) |
| Time limits for erasure | *where possible* — per data category; "indefinido" is a finding, not an answer |
| General description of TOMs | *where possible* — reference the security section of their posture, don't re-audit here |

**Processor record — Art. 30(2)** (the client processes on other controllers' behalf): name +
contacts of the processor and of **each controller** served (plus their reps/DPOs), categories
of processing per controller, third-country transfers + safeguards, and TOMs *where possible*.

Drafting rules:

- The two *where possible* fields (erasure limits, TOMs) are qualified in the regulation —
  incomplete is acceptable there; everything else is mandatory per entry.
- Mark every unconfirmed cell `OPEN: <question>` and keep a closing "Puntos abiertos" list —
  the follow-up solicitud comes straight from it.
- Art. 30(5) exempts <250-employee orgs only when processing is *occasional*, involves no
  special categories (Art. 9) or criminal-offence data (Art. 10), and poses no risk to
  people's rights — in practice almost no operating SME qualifies. Note it if
  the client asks; do not advise skipping the record.
- End the document with a Document Control Block (id, version, owner, review cadence) per the
  client's documentation scheme.

## 3. DELIVER

1. Render the draft as a single markdown (or the client's preferred format) file.
2. Upload via the two-step presigned flow (see manage-evidence-and-deliverables):
   `prepare_artifact_upload` → PUT bytes → `create_artifact_from_upload` with
   `kind="ropa"`, `title` like "Registro de Actividades de Tratamiento — <Cliente> — <YYYY-MM>",
   `classification="confidential"` (**`handling` is then required**), `owner_name`, and the
   client's `document_id_string` (**ask** if you don't have their scheme).
3. Link it where the gap lives: `create_evidence(kind="artifact", artifact_id=<id>,
   evidenceable_type="ControlEvaluation", evidenceable_id=<the gdpr 30.1 CE>)` — and on the
   30.2 CE too when a processor record exists. **Precondition:** the CE must already exist —
   if the client has no GDPR gap analysis / 30.1 evaluation yet, create it first (see
   evaluate-controls) or link to a matching Risk instead; the artifact can also stand alone
   unlinked. Attaching evidence does not change a control verdict. Review the ROPA with the
   consultant and call `update_control_evaluation` only after they confirm the new verdict and
   rationale; until then, continue to report the evaluation's current status, including an open
   gap.
4. Approval (`approve_artifact`) is a governance action: **only on explicit user instruction**,
   owner-only. It stamps `effective_date` and `next_review_date` (+6 months) — that stamp IS
   the review cadence; the ROPA is a living record, not a one-off.
5. Revisions: upload a new artifact with `supersedes_id` pointing at the previous version —
   never overwrite an approved ROPA in place.

## Constraints

- Facts come from the client or from Sekit records; unconfirmed cells are `OPEN:` items.
- Controller vs processor role decides 30(1) vs 30(2); both sections when both roles apply.
- `classification="confidential"` ⇒ `handling` required on the artifact.
- Solicitudes are invisible until the package/request is released; replies land as submissions.
- Approval only when the user says so; new versions supersede, they don't overwrite.
