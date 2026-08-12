# Security policy

## Report a vulnerability privately

Do not open a public issue for a vulnerability involving Sekit, the consultant MCP,
authentication, tenant isolation, authorization, audit data, tokens, uploads, or client data.

Email [ricardo@sekit.ai](mailto:ricardo@sekit.ai) with:

- the affected skill, plugin version, connector endpoint, or Sekit surface;
- reproduction steps and expected impact;
- whether any real tenant or credential may have been exposed; and
- a safe way to contact you for follow-up.

Do not include raw tokens, passwords, client documents, personal data, or destructive proof of
concepts. Use synthetic data and redact secrets. We will acknowledge the report and coordinate
validation and disclosure directly with you.

## Supported versions

Security fixes target the latest published plugin version. Because the skills operate through a
hosted service, connector-side protections may be applied independently of a plugin release.

This policy covers the files in this repository. General product support and non-sensitive bugs
can use GitHub issues.
