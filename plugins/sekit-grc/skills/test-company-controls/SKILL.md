---
name: test-company-controls
description: "Define tests for a Sekit client's company controls and record their results with evidence over the consultant MCP. A test is only a check the company repeats: write the steps, the frequency and the pass criterion, create it on the control, run or collect the check, and record a pass or a fail with a note, an uploaded file or a governed document, a timestamp and an optional validity date. Handle failures and recurring or bot-driven runs without duplicates. Use when the user wants to test a control, add a repeated check such as a nightly backup check, record that a control passed or failed, post the result of a scheduled run, see a control's latest results or health, or retire a test. Not for one-off proof such as a signed NDA or a contract (manage-company-controls attaches that as evidence), for creating or linking the control itself, or for framework verdicts in a gap analysis (evaluate-controls). Read the sekit-mcp-guide skill first."
---

# Test company controls

A **test** is how the company checks that one of its controls works; a **result** is one run of
that test, `pass` or `fail`, backed by evidence. Read **sekit-mcp-guide** first. The control must
already exist: create and link it with **manage-company-controls**.

## Process

### 1. Orient and find the control

`whoami` → `list_clients` → `list_company_controls(client_organization_id, include_archived: true)`.
An archived control (`discarded_at` set) reads as `not_found` and takes no tests or results: offer
to restore it with **manage-company-controls** first. Read the control
with `get_company_control(client_organization_id, company_control_id)`: its `description` says
how the practice runs, and `tests` lists the live tests, each with `latest_result`,
`recent_outcomes` (the last 10, oldest first) and `result_count`. Reuse a live test that already
checks the same thing instead of defining a second one.

### 2. Define the test

A test exists only for a check the company repeats. Proof collected once is evidence on the
control, not a test: a signed NDA or a signed contract is not a test. Attach that with
**manage-company-controls**.

`create_company_control_test(client_organization_id, company_control_id, name, procedure, frequency?, pass_criteria?)`
takes the steps in `procedure` and the cadence and the pass rule in their own fields:

| Part | Where it goes |
|---|---|
| What is checked | `name` (short: «Backup nocturno completado») |
| How | `procedure` («Cómo se prueba»): the steps, the query or command, and where to look. Not the cadence and not the pass rule |
| Frequency | `frequency`: `daily` \| `weekly` \| `monthly` \| `quarterly` \| `semiannual` \| `annual` \| `on_demand`. Omit it when unknown. It is shown only: Sekit does not schedule or remind from `frequency`, and `health` reads neither `frequency` nor `pass_criteria`. An unknown value is refused |
| Pass criteria | `pass_criteria` («Se supera si»): the binary rule fixed before the run, including the threshold, what to attach, and that an unchecked run is not recorded. Omit it when unknown |
| A fail | the pass rule not met. There is no fail-criteria field. Record a fail in step 4 when you observe it |

Example for a nightly database backup:

> `name`: Backup nocturno completado
> `procedure`: Consulta el historial del job de backup de la base de datos de producción en la
> consola del proveedor y lee la última ejecución.
> `frequency`: `daily`
> `pass_criteria`: Hay un backup completado en las últimas 24 h y su tamaño no es cero. Si no se
> puede comprobar, no registres resultado. Adjunta el extracto del historial con fecha, estado y
> tamaño.

Show the draft to the user and create it after they agree. A
live test name is unique per control; a clash returns `company_control_test_name_taken`. The
same fields can be sent in the same write as the control (`tests: [{name, procedure, frequency?, pass_criteria?}]`
on `create_company_control`), still only for a repeated check.

`update_company_control_test` edits `name`, `procedure`, `frequency` or `pass_criteria` in place.
An omitted field is left as it is; `null` clears `frequency` or `pass_criteria` (a blank
`pass_criteria` is no criterion). Registro keeps the old wording. A materially different check
is a new test: archive the old one.

### 3. Run or collect the check

Run the check the `procedure` describes, or collect the result from whoever ran it.
**Record only an outcome you observed.** If you could not run the check or see its output, say so and record
nothing; a missing run is not a pass, and a guessed outcome is not a fail.

### 4. Record the result

`record_company_control_test_result(client_organization_id, company_control_id,
company_control_test_id, test_outcome, ...)`:

| Field | Notes |
|---|---|
| `test_outcome` | required: `pass` («Superada») or `fail` («Fallida») |
| `client_file_id` | an uploaded file as the evidence (upload it first, see **manage-evidence-and-documents**) |
| `artifact_id` | a governed document as the evidence; send at most one of `client_file_id` and `artifact_id` |
| `body` | a written note; otherwise, with neither file nor document, `body` is required. With a file, use it to say what the file shows |
| `collected_at` | when the check ran: a full ISO-8601 timestamp or a bare date (read as midnight UTC). Defaults to now; refused more than 5 minutes in the future. Set it to the run's real time |
| `valid_until` | `YYYY-MM-DD` («Válida hasta»), for a pass only: a failed result takes none, and a pass without it never expires. Set it a little past the next due run (for a daily check, two days out), so a missed run shows up in `health` without a false alert when a run posts late |
| `external_run_id` | a stable id for one run (up to 200 characters), see step 6 |

The origin (note, file or document) is derived from what you send; never send it. The result
returns `{result, created}`. Results are read back with `get_company_control`.
`latest_result` and `recent_outcomes` are ordered by `collected_at`, not by when you posted: a
backfilled result with an earlier `collected_at` does not become the latest one.

### 5. A failed result

Record a fail as soon as it is observed, with what was seen in `body` and the evidence attached.
A failed result does not change `implementation_status`, and neither do you: the control is still
the practice the company runs. When the fail is the test's latest result (by `collected_at`),
`health` turns red or amber on the next read; a backfilled fail older than a pass does not. Report
the `health` you read.

Then ask the user for the follow-up and route it:

- a weakness that could cause harm → a risk or a remediation action, see **analyze-risks**;
- a broken practice that is being fixed → `update_company_control(..., implementation_status:
  "in_progress")` only when the user says so (**manage-company-controls**);
- a wrong test → fix the steps, `frequency` or `pass_criteria` with `update_company_control_test`.
  A materially different check is a new test.

When the fix lands, run the test again and record a new pass. Never rewrite or remove the failed
result; the history is the proof.

### 6. Recurring and bot-driven runs

Sekit does not schedule or remind from `frequency`. The expiry of each pass
(`valid_until`) is what makes a missed run visible.

A scheduled job or bot sends `external_run_id` with every post, for example
`backup-nightly-2026-11-16T02:10Z`, with the run's time, not only its date. The post is idempotent per test and run id: a retry with the same
outcome returns the kept result with `created: false` (also after the test was archived), and
the other outcome for that run id is a conflict. Without a run id every post is a new result, so
a retried post would count twice. Use a new run id for each real run, including a re-run after a fix on the same day, and never for a
retry.

An unattended run records only what its instruction asks for and only outcomes it observed; it
never archives a test.

### 7. Retire a test

Retire a test only when the user explicitly asks for it: archiving changes the control's health.
`archive_company_control_test` is «Descartar» on a test: a test is never deleted.
Its results are kept and stop counting toward the control's health; new results are refused until it is
restored. `restore_company_control_test` brings it back (refused with
`company_control_test_name_taken` when a live test of the control has its name). Both are
idempotent.

## Reporting

Tell the user, per test: the outcome, when it ran, the evidence, `valid_until`, and the
control's `health` after the write. Name a person by their label, never an address.

## Errors

Every tool returns `{"error": "..."}` on failure. Report it; do not retry a result post without
an `external_run_id`, because a retry without one creates a second result. Before a post without a run id, note the test's
`result_count`; after a timeout or an unclear failure, read `get_company_control` first: if
`result_count` grew or `recent_outcomes` holds the run's `collected_at`, it landed, so do not post
it again.

When you run as an agent user, some of your writes are also listed for the consultant's review in
«Actualizaciones de agentes»; **Agent updates** in sekit-mcp-guide says which subjects are. Report
what `list_agent_updates(client_organization_id)` shows after you write; never mark it reviewed
yourself.
